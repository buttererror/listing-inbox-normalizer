import {
  ExtractedOffer,
  TypedFieldCandidate,
  typedFieldCandidateSchema,
} from '../extraction/extraction-result.schema';
import {
  findOccurrences,
  isClippedToken,
  RejectedEvidence,
} from '../extraction/verify-source-integrity';
import type { Assertion } from '../extraction/verify-verbatim-evidence';
import {
  NormalizedAssertion,
  normalizeSupportedAssertions,
} from '../listings/normalize-supported-assertions';

export interface BridgeSaleOutcome {
  accepted: Assertion[];
  rejectedEvidence: RejectedEvidence[];
}

export function bridgeStage1SaleToBaseline(
  sourceText: string,
  offer: ExtractedOffer,
): BridgeSaleOutcome {
  const accepted: Assertion[] = [];
  const rejectedEvidence: RejectedEvidence[] = [];

  const offerInSource = sourceText.includes(offer.offer_quote);

  // First pass: validate candidates, grounding, scope, clipping, occurrences
  const validCandidates: Array<{ candidate: TypedFieldCandidate; assertion: Assertion }> = [];

  for (const rawCandidate of offer.candidates) {
    const parseResult = typedFieldCandidateSchema.safeParse(rawCandidate);
    if (!parseResult.success) {
      const field = typeof (rawCandidate as any)?.field === 'string' ? (rawCandidate as any).field : 'unknown';
      const quote = typeof (rawCandidate as any)?.quote === 'string' ? (rawCandidate as any).quote : '';
      rejectedEvidence.push({
        assertion: { field, quote },
        reason: 'cannot_normalize' as any,
      });
      continue;
    }

    const candidate: TypedFieldCandidate = parseResult.data;
    const assertion: Assertion = {
      field: candidate.field,
      quote: candidate.quote,
    };

    // 1. Verify that offer quote occurs in source and candidate quote occurs in both
    if (!offerInSource || !sourceText.includes(candidate.quote) || !offer.offer_quote.includes(candidate.quote)) {
      rejectedEvidence.push({ assertion, reason: 'quote_not_in_source' });
      continue;
    }

    // 2. Forward only offer-local evidence (deferred shared evidence goes to review path)
    if (candidate.scope !== 'local') {
      rejectedEvidence.push({ assertion, reason: 'field_uncertain' });
      continue;
    }

    // 3. Check token clipping in source text
    const allOccurrences = findOccurrences(sourceText, candidate.quote);
    const unclippedOccurrences = allOccurrences.filter(
      (occ) => !isClippedToken(sourceText, occ.start, occ.end),
    );

    if (unclippedOccurrences.length === 0) {
      rejectedEvidence.push({ assertion, reason: 'clipped_token' });
      continue;
    }

    // 4. Must resolve to exactly one unclipped occurrence
    if (unclippedOccurrences.length > 1) {
      rejectedEvidence.push({ assertion, reason: 'multiple_occurrences' });
      continue;
    }

    validCandidates.push({ candidate, assertion });
  }

  // Second pass: normalize all candidate assertions together so sale context is available for price
  const candidateAssertions = validCandidates.map((v) => v.assertion);
  const { values } = normalizeSupportedAssertions(candidateAssertions);

  for (const { candidate, assertion } of validCandidates) {
    // Find matching normalized value in baseline normalization
    const baseVal = values.find(
      (v) => v.field === candidate.field && v.evidence.quote === candidate.quote,
    );

    if (!baseVal) {
      rejectedEvidence.push({ assertion, reason: 'cannot_normalize' as any });
      continue;
    }

    // Agreement check between candidate typed proposal and baseline normalization
    const agrees = candidateAgreesWithBaseline(candidate, baseVal);
    if (!agrees) {
      rejectedEvidence.push({ assertion, reason: 'quote_not_in_source' });
      continue;
    }

    accepted.push(assertion);
  }

  return { accepted, rejectedEvidence };
}

function candidateAgreesWithBaseline(
  candidate: TypedFieldCandidate,
  baseVal: NormalizedAssertion,
): boolean {
  if (candidate.field !== baseVal.field) return false;

  switch (candidate.field) {
    case 'purpose':
      return baseVal.field === 'purpose' && candidate.value === baseVal.value;

    case 'property_type':
      return baseVal.field === 'property_type' && candidate.value === baseVal.value;

    case 'city':
      return baseVal.field === 'city' && candidate.value === baseVal.value;

    case 'district':
      return baseVal.field === 'district' && candidate.value === baseVal.value;

    case 'bedrooms':
      return baseVal.field === 'bedrooms' && candidate.value === baseVal.value;

    case 'bathrooms':
      return baseVal.field === 'bathrooms' && candidate.value === baseVal.value;

    case 'area_sqm':
      return (
        baseVal.field === 'area_sqm' &&
        candidate.value === baseVal.value &&
        candidate.kind === baseVal.kind
      );

    case 'price':
      return (
        baseVal.field === 'price' &&
        candidate.role === 'asking_price' &&
        candidate.value.amount === baseVal.value.amount &&
        candidate.value.currency === baseVal.value.currency &&
        candidate.value.period === baseVal.value.period
      );

    case 'contact_phone':
      return baseVal.field === 'contact_phone' && candidate.value === baseVal.value;

    default:
      return false;
  }
}
