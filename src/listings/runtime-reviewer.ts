import type { ResolvedOffer, ResolutionFinding } from './resolve-offer';

export interface ReviewDecision {
  needs_review: boolean;
  review_reasons: string[];
}

function reasonForFinding(offer: ResolvedOffer, finding: ResolutionFinding): string | null {
  if (finding.field === null) {
    return finding.issue === 'offer_missing_context' ? 'offer_missing_context' : 'offer_uncertain';
  }

  const applicability = offer.applicability[finding.field];
  if (applicability === 'inapplicable') return null;
  if (finding.issue === 'missing' && applicability !== 'applicable') return null;

  switch (finding.issue) {
    case 'missing':
    case 'conflict':
    case 'uncertain':
    case 'unsupported':
    case 'currency_unknown':
    case 'period_unknown':
      return `${finding.field}_${finding.issue}`;
    case 'arithmetic_inconsistent':
      return `${finding.field}_arithmetic_inconsistent`;
    case 'offer_uncertain':
    case 'offer_missing_context':
      return null;
  }
}

/**
 * Turns a completed resolution into deterministic review status. This function never
 * changes resolved values or source provenance.
 */
export function reviewResolvedOffer(offer: ResolvedOffer): ReviewDecision {
  const reasons: string[] = [];
  const seen = new Set<string>();
  for (const finding of offer.findings) {
    const reason = reasonForFinding(offer, finding);
    if (reason && !seen.has(reason)) {
      seen.add(reason);
      reasons.push(reason);
    }
  }
  return {
    needs_review: reasons.length > 0,
    review_reasons: reasons,
  };
}
