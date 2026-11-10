import {
  BaseClass,
  CandidateScope,
  ExtractedOffer,
  MessageClassification,
  SemanticFinding,
  semanticFindingSchema,
  Stage1ExtractionResult,
  TypedFieldCandidate,
  typedFieldCandidateSchema,
  validateExtractionEnvelope,
} from './extraction-result.schema';
import {
  findOccurrences,
  isClippedToken,
} from './verify-source-integrity';

/**
 * Deterministic rejection reasons for Stage 2 Mechanical Validation.
 */
export type Stage2RejectionReason =
  | 'invalid_schema'
  | 'quote_not_in_source'
  | 'offer_not_in_source'
  | 'wrong_offer'
  | 'clipped_token'
  | 'multiple_occurrences'
  | 'unscoped_shared_evidence';

/**
 * A candidate rejected during Stage 2 with its original untrusted payload and deterministic reason.
 */
export interface RejectedCandidate {
  candidate: unknown;
  field?: string;
  quote?: string;
  scope?: CandidateScope;
  reason: Stage2RejectionReason;
  message?: string;
}

/**
 * A semantic finding rejected during Stage 2 validation.
 */
export interface RejectedFinding {
  finding: unknown;
  field?: string | null;
  quote?: string | null;
  reason: Stage2RejectionReason;
  message?: string;
}

/**
 * Validation finding recorded by Stage 2 mechanical validation.
 */
export interface ValidationFinding {
  category:
    | 'schema_violation'
    | 'ungrounded_evidence'
    | 'wrong_offer'
    | 'clipped_evidence'
    | 'ambiguous_evidence';
  field?: string | null;
  quote?: string | null;
  description: string;
}

/**
 * Outcome of Stage 2 Mechanical Validation for an individual property offer.
 */
export interface OfferValidationOutcome {
  offer_quote: string;
  acceptedCandidates: TypedFieldCandidate[];
  rejectedCandidates: RejectedCandidate[];
  semanticFindings: SemanticFinding[];
  rejectedFindings: RejectedFinding[];
  validationFindings: ValidationFinding[];
}

/**
 * Top-level outcome of Stage 2 Mechanical Validation.
 */
export type Stage2ValidationOutcome =
  | {
      ok: true;
      classification: MessageClassification;
      detected_classes: BaseClass[];
      offers: OfferValidationOutcome[];
    }
  | {
      ok: false;
      error: {
        code: 'invalid_extraction';
        message: string;
      };
    };

/**
 * Step 1: Independently validate candidate schema against typed candidate union.
 * Input remains typed as `unknown` until it passes schema validation.
 */
export function validateCandidateSchema(raw: unknown): {
  success: boolean;
  candidate?: TypedFieldCandidate;
  error?: string;
} {
  const parseResult = typedFieldCandidateSchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((i) => i.message).join('; '),
    };
  }
  return {
    success: true,
    candidate: parseResult.data,
  };
}

/**
 * Step 2: Independently validate semantic finding schema.
 */
export function validateSemanticFindingSchema(raw: unknown): {
  success: boolean;
  finding?: SemanticFinding;
  error?: string;
} {
  const parseResult = semanticFindingSchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((i) => i.message).join('; '),
    };
  }
  return {
    success: true,
    finding: parseResult.data,
  };
}

/**
 * Occurrence interval helper.
 */
interface Span {
  start: number;
  end: number;
}

/**
 * Stage 2: Mechanical Validation entry point for extraction structure and source evidence.
 *
 * Check order:
 * 1. Envelope validation: ensure classification, detected classes, and offer groupings adhere to the contract.
 * 2. Offer grounding: verify that claimed offer quotes exist in source text.
 *    If property offers are claimed but none can be grounded, fail with `invalid_extraction`.
 * 3. Candidate schema check: validate each candidate schema independently. Invalid entries are rejected
 *    without failing the offer or message (partial recovery).
 * 4. Evidence existence & scoping:
 *    - Verify verbatim occurrence in source text.
 *    - For offer-local scope: verify the quote belongs to the offer quote and falls within the offer span.
 *    - For shared scope: verify the quote exists in source text and can legitimately be associated
 *      (not exclusively inside another offer's local boundary).
 * 5. Integrity & clipping: detect cuts through words, numbers, and signs.
 * 6. Occurrence & ambiguity: disambiguate repeated quotes by scoping to the offer.
 *    Quotes that repeat ambiguously within a single offer's scope are rejected.
 * 7. Semantic findings validation: validate shape, verbatim evidence, clipping, and offer association.
 */
export function validateStage2(
  sourceText: string,
  rawExtraction: unknown,
): Stage2ValidationOutcome {
  // 1. Envelope validation
  const envelopeResult = validateExtractionEnvelope(rawExtraction);
  if (!envelopeResult.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid_extraction',
        message: `Invalid extraction envelope: ${envelopeResult.error}`,
      },
    };
  }

  const { classification, detected_classes, listings: rawOffers } = envelopeResult.data;

  // Non-listing intents with no offers are valid empty results
  if (rawOffers.length === 0) {
    return {
      ok: true,
      classification,
      detected_classes,
      offers: [],
    };
  }

  // 2. Offer grounding
  // Find spans for each offer in the source text
  const offerSpans: Array<{ offer: (typeof rawOffers)[number]; spans: Span[] }> = [];
  for (const rawOffer of rawOffers) {
    const spans = findOccurrences(sourceText, rawOffer.offer_quote);
    if (spans.length > 0) {
      offerSpans.push({ offer: rawOffer, spans });
    }
  }

  // If the model claimed property offers, but NONE of them exist in the source message,
  // the entire extraction is ungrounded and unusable.
  if (offerSpans.length === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid_extraction',
        message: 'None of the claimed property offers could be grounded in source text',
      },
    };
  }

  const validatedOffers: OfferValidationOutcome[] = [];

  for (let i = 0; i < offerSpans.length; i++) {
    const { offer, spans: currentOfferSpans } = offerSpans[i];
    const otherOffersSpans: Span[] = offerSpans
      .filter((_, idx) => idx !== i)
      .flatMap((o) => o.spans);

    const acceptedCandidates: TypedFieldCandidate[] = [];
    const rejectedCandidates: RejectedCandidate[] = [];
    const semanticFindings: SemanticFinding[] = [];
    const rejectedFindings: RejectedFinding[] = [];
    const validationFindings: ValidationFinding[] = [];

    // 3 & 4. Validate candidates independently
    for (const rawCandidate of offer.candidates) {
      // 3.1 Validate candidate schema
      const schemaCheck = validateCandidateSchema(rawCandidate);
      if (!schemaCheck.success || !schemaCheck.candidate) {
        const field = typeof (rawCandidate as any)?.field === 'string' ? (rawCandidate as any).field : undefined;
        const quote = typeof (rawCandidate as any)?.quote === 'string' ? (rawCandidate as any).quote : undefined;
        const scope = typeof (rawCandidate as any)?.scope === 'string' ? (rawCandidate as any).scope : undefined;
        rejectedCandidates.push({
          candidate: rawCandidate,
          field,
          quote,
          scope,
          reason: 'invalid_schema',
          message: schemaCheck.error,
        });
        validationFindings.push({
          category: 'schema_violation',
          field,
          quote,
          description: `Candidate failed schema: ${schemaCheck.error}`,
        });
        continue;
      }

      const candidate = schemaCheck.candidate;

      // 4.1 Verbatim occurrence in the source message
      if (!sourceText.includes(candidate.quote)) {
        rejectedCandidates.push({
          candidate: rawCandidate,
          field: candidate.field,
          quote: candidate.quote,
          scope: candidate.scope,
          reason: 'quote_not_in_source',
          message: 'Quote does not appear in the source message',
        });
        validationFindings.push({
          category: 'ungrounded_evidence',
          field: candidate.field,
          quote: candidate.quote,
          description: 'Candidate quote does not appear in source message',
        });
        continue;
      }

      // 4.2 Scoping & association
      if (candidate.scope === 'local') {
        // Offer-local evidence must appear inside this offer's quote
        if (!offer.offer_quote.includes(candidate.quote)) {
          rejectedCandidates.push({
            candidate: rawCandidate,
            field: candidate.field,
            quote: candidate.quote,
            scope: 'local',
            reason: 'wrong_offer',
            message: 'Offer-local quote is not present inside the claimed offer quote',
          });
          validationFindings.push({
            category: 'wrong_offer',
            field: candidate.field,
            quote: candidate.quote,
            description: 'Candidate quote belongs to another offer or outside offer boundary',
          });
          continue;
        }

        // Find occurrences of candidate quote within the offer's span in source text
        const quoteOccurrences = findOccurrences(sourceText, candidate.quote);
        const inOfferOccurrences = quoteOccurrences.filter((qOcc) =>
          currentOfferSpans.some(
            (oSpan) => qOcc.start >= oSpan.start && qOcc.end <= oSpan.end,
          ),
        );

        // Filter for unclipped tokens
        const unclippedOccurrences = inOfferOccurrences.filter(
          (occ) => !isClippedToken(sourceText, occ.start, occ.end),
        );

        if (unclippedOccurrences.length === 0) {
          rejectedCandidates.push({
            candidate: rawCandidate,
            field: candidate.field,
            quote: candidate.quote,
            scope: 'local',
            reason: 'clipped_token',
            message: 'Candidate quote token is clipped within offer span',
          });
          validationFindings.push({
            category: 'clipped_evidence',
            field: candidate.field,
            quote: candidate.quote,
            description: 'Quote boundary cuts through an alphanumeric word or number separator',
          });
          continue;
        }

        // Multiple unclipped occurrences within the same offer remain ambiguous
        if (unclippedOccurrences.length > 1) {
          rejectedCandidates.push({
            candidate: rawCandidate,
            field: candidate.field,
            quote: candidate.quote,
            scope: 'local',
            reason: 'multiple_occurrences',
            message: 'Quote appears multiple times ambiguously within the same offer',
          });
          validationFindings.push({
            category: 'ambiguous_evidence',
            field: candidate.field,
            quote: candidate.quote,
            description: 'Repeated quote remains ambiguous within offer scope',
          });
          continue;
        }

        // Local evidence passed all checks
        acceptedCandidates.push(candidate);
      } else {
        // candidate.scope === 'shared'
        const quoteOccurrences = findOccurrences(sourceText, candidate.quote);
        const unclippedOccurrences = quoteOccurrences.filter(
          (occ) => !isClippedToken(sourceText, occ.start, occ.end),
        );

        if (unclippedOccurrences.length === 0) {
          rejectedCandidates.push({
            candidate: rawCandidate,
            field: candidate.field,
            quote: candidate.quote,
            scope: 'shared',
            reason: 'clipped_token',
            message: 'Shared candidate quote token is clipped in source text',
          });
          validationFindings.push({
            category: 'clipped_evidence',
            field: candidate.field,
            quote: candidate.quote,
            description: 'Shared quote boundary cuts through an alphanumeric word or number separator',
          });
          continue;
        }

        // Check legitimate association:
        // Shared evidence is legitimate if it appears in shared message context (outside other offers)
        // or within this offer. If every unclipped occurrence lies exclusively inside other offers,
        // it cannot legitimately be associated as shared evidence for this offer.
        const hasLegitimateOccurrence = unclippedOccurrences.some((occ) => {
          const inCurrentOffer = currentOfferSpans.some(
            (s) => occ.start >= s.start && occ.end <= s.end,
          );
          if (inCurrentOffer) return true;
          const inOtherOffers = otherOffersSpans.some(
            (s) => occ.start >= s.start && occ.end <= s.end,
          );
          // Outside all other offers -> shared context
          return !inOtherOffers;
        });

        if (!hasLegitimateOccurrence) {
          rejectedCandidates.push({
            candidate: rawCandidate,
            field: candidate.field,
            quote: candidate.quote,
            scope: 'shared',
            reason: 'unscoped_shared_evidence',
            message: 'Evidence claimed as shared belongs exclusively to another offer',
          });
          validationFindings.push({
            category: 'wrong_offer',
            field: candidate.field,
            quote: candidate.quote,
            description: 'Shared evidence occurs exclusively inside another offer span',
          });
          continue;
        }

        acceptedCandidates.push(candidate);
      }
    }

    // 5. Validate semantic findings independently (Task 02.3 merged into 02.2)
    for (const rawFinding of offer.findings) {
      const schemaCheck = validateSemanticFindingSchema(rawFinding);
      if (!schemaCheck.success || !schemaCheck.finding) {
        rejectedFindings.push({
          finding: rawFinding,
          reason: 'invalid_schema',
          message: schemaCheck.error,
        });
        validationFindings.push({
          category: 'schema_violation',
          description: `Semantic finding failed schema: ${schemaCheck.error}`,
        });
        continue;
      }

      const finding = schemaCheck.finding;

      // If finding includes supporting evidence quote, verify it
      if (typeof finding.quote === 'string' && finding.quote.length > 0) {
        if (!sourceText.includes(finding.quote)) {
          rejectedFindings.push({
            finding: rawFinding,
            field: finding.field,
            quote: finding.quote,
            reason: 'quote_not_in_source',
            message: 'Finding quote does not appear in source message',
          });
          validationFindings.push({
            category: 'ungrounded_evidence',
            field: finding.field ?? undefined,
            quote: finding.quote,
            description: 'Semantic finding quote not found in source text',
          });
          continue;
        }

        // Check clipping on finding quote
        const occs = findOccurrences(sourceText, finding.quote);
        const unclipped = occs.filter(
          (occ) => !isClippedToken(sourceText, occ.start, occ.end),
        );
        if (unclipped.length === 0) {
          rejectedFindings.push({
            finding: rawFinding,
            field: finding.field,
            quote: finding.quote,
            reason: 'clipped_token',
            message: 'Finding quote token is clipped',
          });
          validationFindings.push({
            category: 'clipped_evidence',
            field: finding.field ?? undefined,
            quote: finding.quote,
            description: 'Finding quote cuts through token boundary',
          });
          continue;
        }

        // Check wrong-offer association for finding
        // If quote is inside another offer's span and completely absent from this offer or shared context
        const inCurrentOffer = currentOfferSpans.some((s) =>
          occs.some((o) => o.start >= s.start && o.end <= s.end),
        );
        const inSharedContext = occs.some(
          (o) =>
            !otherOffersSpans.some(
              (other) => o.start >= other.start && o.end <= other.end,
            ),
        );

        if (!inCurrentOffer && !inSharedContext) {
          rejectedFindings.push({
            finding: rawFinding,
            field: finding.field,
            quote: finding.quote,
            reason: 'wrong_offer',
            message: 'Finding quote belongs to another offer',
          });
          validationFindings.push({
            category: 'wrong_offer',
            field: finding.field ?? undefined,
            quote: finding.quote,
            description: 'Finding evidence belongs to another offer',
          });
          continue;
        }
      }

      // Valid finding preserved
      semanticFindings.push(finding);
    }

    validatedOffers.push({
      offer_quote: offer.offer_quote,
      acceptedCandidates,
      rejectedCandidates,
      semanticFindings,
      rejectedFindings,
      validationFindings,
    });
  }

  return {
    ok: true,
    classification,
    detected_classes,
    offers: validatedOffers,
  };
}
