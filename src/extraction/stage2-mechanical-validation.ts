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
  | 'multiple_occurrences'
  | 'unscoped_shared_evidence'
  | 'invalid_numeric_constraint'
  | 'invalid_format'
  | 'quote_value_mismatch';

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
    | 'ambiguous_evidence'
    | 'numeric_constraint_violation'
    | 'format_violation'
    | 'quote_value_mismatch'
    | 'arithmetic_inconsistency';
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
 * Normalizes Eastern Arabic-Indic and Arabic-Indic numerals to ASCII 0-9.
 */
export function normalizeDigitsToAscii(str: string): string {
  return str
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
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
 * Task 02.4 — 3. Cross-check mechanically verifiable source consistency.
 * Detect clear mismatches between normalized values and their evidence when the comparison
 * is mechanically unambiguous (e.g. "3 BR" with bedrooms: 4, "3.2M" with price: 320000,
 * or phone digits mismatch).
 */
export function crossCheckMechanicalConsistency(candidate: TypedFieldCandidate): {
  valid: boolean;
  reason?: Stage2RejectionReason;
  message?: string;
} {
  const quoteAscii = normalizeDigitsToAscii(candidate.quote);

  switch (candidate.field) {
    case 'bedrooms':
    case 'bathrooms': {
      // Find explicit digit token in quote (e.g. "3 BR", "٣ غرف", "5 baths")
      const digitMatch = quoteAscii.match(/(?:^|[^\d.,])(\d+)(?:[^\d.,]|$)/);
      if (digitMatch) {
        const num = parseInt(digitMatch[1], 10);
        if (num !== candidate.value) {
          return {
            valid: false,
            reason: 'quote_value_mismatch',
            message: `Candidate quote "${candidate.quote}" specifies quantity ${num}, but normalized value is ${candidate.value}`,
          };
        }
      }
      break;
    }

    case 'area_sqm': {
      // Find explicit numeric area in quote (e.g. "165 sqm", "١٦٥ م²", "380.5 m2")
      const numMatch = quoteAscii.match(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)/);
      if (numMatch) {
        const parsed = parseFloat(numMatch[1].replace(',', '.'));
        if (Number.isFinite(parsed) && parsed !== candidate.value) {
          return {
            valid: false,
            reason: 'quote_value_mismatch',
            message: `Candidate quote "${candidate.quote}" specifies area ${parsed}, but normalized value is ${candidate.value}`,
          };
        }
      }
      break;
    }

    case 'price': {
      // 0. Role / qualifier consistency check: detect unambiguous mismatch between quote qualifiers and candidate role
      if (candidate.role === 'asking_price') {
        if (candidate.quote.includes('عربون') || /\bdeposit\b/i.test(candidate.quote)) {
          return {
            valid: false,
            reason: 'quote_value_mismatch',
            message: `Price quote "${candidate.quote}" specifies deposit/earnest money (عربون), but candidate role is asking_price`,
          };
        }
        if (candidate.quote.includes('للمتر') || /\b(?:per\s*sqm|\/sqm|\/m2)\b/i.test(candidate.quote)) {
          return {
            valid: false,
            reason: 'quote_value_mismatch',
            message: `Price quote "${candidate.quote}" specifies per-sqm rate (للمتر), but candidate role is asking_price`,
          };
        }
      }

      const amount = candidate.value.amount;

      // 1. Shorthand Millions (e.g. "3.2M", "3.2 M", "3.2M SAR", "٣٫٢ مليون", "2 مليون")
      const millionMatch = quoteAscii.match(
        /(\d+(?:[.,\u066b]\d+)?)\s*(?:M\b|مليون(?:[^\p{L}\p{N}]|$))/iu,
      );
      if (millionMatch) {
        const base = parseFloat(millionMatch[1].replace(/[\u066b,]/g, '.'));
        if (Number.isFinite(base)) {
          const expected = base * 1_000_000;
          if (Math.abs(expected - amount) > 1) {
            return {
              valid: false,
              reason: 'quote_value_mismatch',
              message: `Price quote "${candidate.quote}" specifies ${base}M (${expected}), but normalized amount is ${amount}`,
            };
          }
        }
        break;
      }

      // 2. Shorthand Thousands (e.g. "950K", "950 K", "950 ألف")
      const thousandMatch = quoteAscii.match(
        /(\d+(?:[.,\u066b]\d+)?)\s*(?:K\b|ألف(?:[^\p{L}\p{N}]|$))/iu,
      );
      if (thousandMatch) {
        const base = parseFloat(thousandMatch[1].replace(/[\u066b,]/g, '.'));
        if (Number.isFinite(base)) {
          const expected = base * 1_000;
          if (Math.abs(expected - amount) > 1) {
            return {
              valid: false,
              reason: 'quote_value_mismatch',
              message: `Price quote "${candidate.quote}" specifies ${base}K (${expected}), but normalized amount is ${amount}`,
            };
          }
        }
        break;
      }

      // 3. Full explicit number (e.g. "950,000", "950000", "٩٥٠٬٠٠٠")
      const fullNumMatch = quoteAscii.match(/(?:^|[^\d.,])(\d{1,3}(?:[,\s]\d{3})+|\d{4,})(?:[^\d.,]|$)/);
      if (fullNumMatch) {
        const raw = fullNumMatch[1].replace(/[,\s]/g, '');
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed !== amount) {
          return {
            valid: false,
            reason: 'quote_value_mismatch',
            message: `Price quote "${candidate.quote}" specifies amount ${parsed}, but normalized amount is ${amount}`,
          };
        }
      }
      break;
    }

    case 'contact_phone': {
      // Cross-check that the normalized Saudi mobile ends with the same subscriber digits as the quote
      const quoteDigits = quoteAscii.replace(/\D/g, '');
      const valueDigits = candidate.value.replace(/\D/g, '');
      if (quoteDigits.length >= 9 && valueDigits.length >= 9) {
        const quoteSuffix = quoteDigits.slice(-9);
        const valueSuffix = valueDigits.slice(-9);
        if (quoteSuffix !== valueSuffix) {
          return {
            valid: false,
            reason: 'quote_value_mismatch',
            message: `Normalized phone "${candidate.value}" digits do not match quote digits "${candidate.quote}"`,
          };
        }
      }
      break;
    }

    default:
      break;
  }

  return { valid: true };
}

/**
 * Task 02.4 — Check arithmetic consistency when relevant operands are explicitly represented and grounded.
 * E.g. area (sqm) * rate (SAR/sqm) = total asking price.
 */
export function crossCheckOfferArithmetic(acceptedCandidates: TypedFieldCandidate[]): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  const areaCandidate = acceptedCandidates.find((c) => c.field === 'area_sqm');
  const rateCandidate = acceptedCandidates.find(
    (c) => c.field === 'price' && (c as any).role === 'per_sqm_rate',
  );
  const askingPriceCandidate = acceptedCandidates.find(
    (c) => c.field === 'price' && (c as any).role === 'asking_price',
  );

  if (areaCandidate && rateCandidate && askingPriceCandidate) {
    const area = areaCandidate.value;
    const rate = (rateCandidate as any).value.amount;
    const total = (askingPriceCandidate as any).value.amount;

    if (Number.isFinite(area) && Number.isFinite(rate) && Number.isFinite(total)) {
      const expectedTotal = area * rate;
      if (Math.abs(expectedTotal - total) > 1) {
        findings.push({
          category: 'arithmetic_inconsistency',
          field: 'price',
          quote: (askingPriceCandidate as any).quote,
          description: `Arithmetic inconsistency: area (${area} sqm) * rate (${rate} SAR/sqm) = ${expectedTotal}, but asking price is ${total}`,
        });
      }
    }
  }

  return findings;
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
 * numerical constraints, formats, and consistency (02.2 + 02.4).
 *
 * Check order:
 * 1. Envelope validation: ensure classification, detected classes, and offer groupings adhere to the contract.
 * 2. Offer grounding: verify that claimed offer quotes exist in source text.
 *    If property offers are claimed but none can be grounded, fail with `invalid_extraction`.
 * 3. Candidate schema check: validate each candidate schema independently (typed as unknown until valid).
 * 4. Evidence existence & scoping:
 *    - Verify verbatim occurrence in source text.
 *    - For offer-local scope: verify the quote belongs to the offer quote and falls within the offer span.
 *    - For shared scope: verify the quote exists in source text and can legitimately be associated.
 * 5. Token clipping: detect cuts through words, numbers, and signs.
 * 6. Occurrence & ambiguity: disambiguate repeated quotes by scoping to the offer.
 * 7. Numerical constraints (02.4): finite, integer, non-negative, positive bounds.
 * 8. Format validation (02.4): Saudi phone E.164, currency, price role, period, area kind.
 * 9. Mechanical consistency (02.4): quote/value mismatch check for quantities, shorthand prices, phone digits.
 * 10. Arithmetic cross-check (02.4): check explicit linked operands within the offer.
 * 11. Semantic findings validation (02.2 / 02.3): validate shape, verbatim evidence, clipping, and offer association.
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
  const offerSpans: Array<{ offer: (typeof rawOffers)[number]; spans: Span[] }> = [];
  for (const rawOffer of rawOffers) {
    const spans = findOccurrences(sourceText, rawOffer.offer_quote);
    if (spans.length > 0) {
      offerSpans.push({ offer: rawOffer, spans });
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
    const { offer, spans: currentOfferSpans } = offerSpans[i];
    const otherOffersSpans: Span[] = offerSpans
      .filter((_, idx) => idx !== i)
      .flatMap((o) => o.spans);

    const acceptedCandidates: TypedFieldCandidate[] = [];
    const rejectedCandidates: RejectedCandidate[] = [];
    const semanticFindings: SemanticFinding[] = [];
    const rejectedFindings: RejectedFinding[] = [];
    const validationFindings: ValidationFinding[] = [];

    // 3, 4, 5, 6, 7, 8, 9: Validate candidates independently
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

      // 9. Mechanically verifiable source consistency (02.4)
      const consistencyCheck = crossCheckMechanicalConsistency(candidate);
      if (!consistencyCheck.valid) {
        rejectedCandidates.push({
          candidate: rawCandidate,
          field: candidate.field,
          quote: candidate.quote,
          scope: candidate.scope,
          reason: consistencyCheck.reason!,
          message: consistencyCheck.message,
        });
        validationFindings.push({
          category: 'quote_value_mismatch',
          field: candidate.field,
          quote: candidate.quote,
          description: consistencyCheck.message ?? 'Normalized value does not match verbatim quote',
        });
        continue;
      }

      // Passed all Stage 2 mechanical validation checks
      acceptedCandidates.push(candidate);
    }

    // 10. Check arithmetic consistency across accepted candidates in this offer (02.4)
    const arithmeticFindings = crossCheckOfferArithmetic(acceptedCandidates);
    validationFindings.push(...arithmeticFindings);

    // 11. Validate semantic findings independently (02.2 / 02.3)
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
      offer_index: i,
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
