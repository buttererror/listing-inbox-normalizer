import {
  BaseClass,
  CandidateScope,
  MessageClassification,
  SemanticFinding,
  semanticFindingSchema,
  TypedFieldCandidate,
  typedFieldCandidateSchema,
  validateExtractionEnvelope,
} from './extraction-result.schema';
import {
  findOccurrences,
  isClippedToken,
} from './verify-source-integrity';

/**
 * Deterministic rejection reasons for Stage 2 Mechanical Validation (02.2 & 02.4).
 */
export type Stage2RejectionReason =
  | 'invalid_schema'
  | 'quote_not_in_source'
  | 'offer_not_in_source'
  | 'wrong_offer'
  | 'clipped_token'
  | 'invalid_numeric_constraint'
  | 'invalid_format';

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
    | 'numeric_constraint_violation'
    | 'format_violation';
  field?: string | null;
  quote?: string | null;
  description: string;
}

/**
 * Outcome of Stage 2 Mechanical Validation for an individual property offer.
 */
export interface OfferValidationOutcome {
  offer_index: number;
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

export type ValidatedExtractionOutcome = Extract<Stage2ValidationOutcome, { ok: true }>;

/**
 * Step 1: Independently validate candidate schema against typed candidate union.
 * Input remains typed as `unknown` until it passes schema validation.
 */
export function validateCandidateSchema(raw: unknown): {
  success: boolean;
  candidate?: TypedFieldCandidate;
  error?: string;
  issues?: any[];
} {
  const parseResult = typedFieldCandidateSchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((i) => i.message).join('; '),
      issues: parseResult.error.issues,
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
 * Task 02.4 — 1. Validate numerical constraints.
 * Check expected numeric types, finiteness, integer requirements, and non-negative/positive bounds.
 */
export function validateCandidateNumericConstraints(candidate: TypedFieldCandidate): {
  valid: boolean;
  reason?: Stage2RejectionReason;
  message?: string;
} {
  switch (candidate.field) {
    case 'bedrooms':
      if (!Number.isFinite(candidate.value) || !Number.isInteger(candidate.value) || candidate.value < 0) {
        return {
          valid: false,
          reason: 'invalid_numeric_constraint',
          message: `Bedrooms must be a non-negative integer, got ${candidate.value}`,
        };
      }
      break;

    case 'bathrooms':
      if (!Number.isFinite(candidate.value) || !Number.isInteger(candidate.value) || candidate.value < 0) {
        return {
          valid: false,
          reason: 'invalid_numeric_constraint',
          message: `Bathrooms must be a non-negative integer, got ${candidate.value}`,
        };
      }
      break;

    case 'area_sqm':
      if (!Number.isFinite(candidate.value) || candidate.value <= 0) {
        return {
          valid: false,
          reason: 'invalid_numeric_constraint',
          message: `Area must be a finite positive number, got ${candidate.value}`,
        };
      }
      break;

    case 'price':
      if (!Number.isFinite(candidate.value.amount) || candidate.value.amount <= 0) {
        return {
          valid: false,
          reason: 'invalid_numeric_constraint',
          message: `Price amount must be a finite positive number, got ${candidate.value.amount}`,
        };
      }
      break;

    default:
      break;
  }

  return { valid: true };
}

/**
 * Task 02.4 — 2. Validate formats.
 * Check canonical Saudi mobile format +9665XXXXXXXX, currency, price roles, periods, and area kinds.
 */
export function validateCandidateFormats(candidate: TypedFieldCandidate): {
  valid: boolean;
  reason?: Stage2RejectionReason;
  message?: string;
} {
  switch (candidate.field) {
    case 'contact_phone':
      if (!/^\+9665\d{8}$/.test(candidate.value)) {
        return {
          valid: false,
          reason: 'invalid_format',
          message: `Contact phone must follow Saudi E.164 mobile format +9665XXXXXXXX, got "${candidate.value}"`,
        };
      }
      break;

    case 'price':
      if (candidate.value.currency !== 'SAR' && candidate.value.currency !== null) {
        return {
          valid: false,
          reason: 'invalid_format',
          message: `Price currency must be 'SAR' or null, got "${candidate.value.currency}"`,
        };
      }
      if (
        candidate.value.period !== 'total' &&
        candidate.value.period !== 'yearly' &&
        candidate.value.period !== 'monthly' &&
        candidate.value.period !== null
      ) {
        return {
          valid: false,
          reason: 'invalid_format',
          message: `Price period must be total, yearly, monthly, or null, got "${candidate.value.period}"`,
        };
      }
      break;

    case 'area_sqm':
      if (
        candidate.kind !== 'land' &&
        candidate.kind !== 'built_up' &&
        candidate.kind !== 'unspecified'
      ) {
        return {
          valid: false,
          reason: 'invalid_format',
          message: `Area kind must be land, built_up, or unspecified, got "${candidate.kind}"`,
        };
      }
      break;

    default:
      break;
  }

  return { valid: true };
}

/**
 * Occurrence interval helper.
 */
interface Span {
  start: number;
  end: number;
}

/**
 * Stage 2: Mechanical Validation entry point for extraction structure, source evidence,
 * numerical constraints, and canonical formats (02.2 + 02.4).
 *
 * Check order:
 * 1. Envelope validation: ensure classification, detected classes, and offer groupings adhere to the contract.
 * 2. Offer grounding: verify that claimed offer quotes exist in source text.
 *    If property offers are claimed but none can be grounded, fail with `invalid_extraction`.
 * 3. Candidate schema check: validate each candidate schema independently (typed as unknown until valid).
 * 4. Evidence existence & scoping:
 *    - Verify verbatim occurrence in source text.
 *    - For offer-local scope: verify the quote belongs to the offer quote and falls within the offer span.
 *    - For shared scope: verify the quote exists in source text; Stage 1 owns applicability.
 * 5. Token clipping: detect cuts through words, numbers, and signs.
 * 6. Numerical constraints (02.4): finite, integer, non-negative, positive bounds.
 * 7. Format validation (02.4): Saudi phone E.164, currency, price role, period, area kind.
 * 8. Semantic findings validation (02.2 / 02.3): validate shape, verbatim evidence, clipping, and offer association.
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
  const offerSpans: Array<{ offer: (typeof rawOffers)[number]; offerIndex: number; spans: Span[] }> = [];
  for (const [offerIndex, rawOffer] of rawOffers.entries()) {
    const spans = findOccurrences(sourceText, rawOffer.offer_quote);
    if (spans.length > 0) {
      offerSpans.push({ offer: rawOffer, offerIndex, spans });
    }
  }

  // If property offers were claimed, but NONE of them exist in the source message, fail with invalid_extraction
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
    const { offer, offerIndex, spans: currentOfferSpans } = offerSpans[i];
    const otherOffersSpans: Span[] = offerSpans
      .filter((_, idx) => idx !== i)
      .flatMap((o) => o.spans);

    const acceptedCandidates: TypedFieldCandidate[] = [];
    const rejectedCandidates: RejectedCandidate[] = [];
    const semanticFindings: SemanticFinding[] = [];
    const rejectedFindings: RejectedFinding[] = [];
    const validationFindings: ValidationFinding[] = [];

    // Validate candidates independently.
    for (const rawCandidate of offer.candidates) {
      // 3. Candidate schema check
      const schemaCheck = validateCandidateSchema(rawCandidate);
      if (!schemaCheck.success || !schemaCheck.candidate) {
        const field = typeof (rawCandidate as any)?.field === 'string' ? (rawCandidate as any).field : undefined;
        const quote = typeof (rawCandidate as any)?.quote === 'string' ? (rawCandidate as any).quote : undefined;
        const scope = typeof (rawCandidate as any)?.scope === 'string' ? (rawCandidate as any).scope : undefined;

        const isNumericConstraint =
          (field === 'bedrooms' || field === 'bathrooms' || field === 'area_sqm' || field === 'price') &&
          schemaCheck.issues?.some(
            (i: any) =>
              i.code === 'too_small' ||
              i.code === 'too_big' ||
              i.message?.toLowerCase().includes('integer') ||
              i.message?.toLowerCase().includes('greater than') ||
              (i.path && (i.path.includes('amount') || i.path.includes('value'))),
          );

        const reason: Stage2RejectionReason = isNumericConstraint ? 'invalid_numeric_constraint' : 'invalid_schema';
        const category = isNumericConstraint ? 'numeric_constraint_violation' : 'schema_violation';

        rejectedCandidates.push({
          candidate: rawCandidate,
          field,
          quote,
          scope,
          reason,
          message: schemaCheck.error,
        });
        validationFindings.push({
          category,
          field,
          quote,
          description: `Candidate failed ${reason}: ${schemaCheck.error}`,
        });
        continue;
      }

      const candidate = schemaCheck.candidate;

      // 4. Verbatim occurrence in source text
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

      // 4. Scoping & association
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

      }

      // 7. Numerical constraints check (02.4)
      const numericCheck = validateCandidateNumericConstraints(candidate);
      if (!numericCheck.valid) {
        rejectedCandidates.push({
          candidate: rawCandidate,
          field: candidate.field,
          quote: candidate.quote,
          scope: candidate.scope,
          reason: numericCheck.reason!,
          message: numericCheck.message,
        });
        validationFindings.push({
          category: 'numeric_constraint_violation',
          field: candidate.field,
          quote: candidate.quote,
          description: numericCheck.message ?? 'Candidate failed numeric constraint check',
        });
        continue;
      }

      // 8. Format validation (02.4)
      const formatCheck = validateCandidateFormats(candidate);
      if (!formatCheck.valid) {
        rejectedCandidates.push({
          candidate: rawCandidate,
          field: candidate.field,
          quote: candidate.quote,
          scope: candidate.scope,
          reason: formatCheck.reason!,
          message: formatCheck.message,
        });
        validationFindings.push({
          category: 'format_violation',
          field: candidate.field,
          quote: candidate.quote,
          description: formatCheck.message ?? 'Candidate failed format check',
        });
        continue;
      }

      // Passed all Stage 2 mechanical validation checks
      acceptedCandidates.push(candidate);
    }

    // Validate semantic findings independently (02.2 / 02.3)
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
      offer_index: offerIndex,
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
