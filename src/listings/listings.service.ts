import { Injectable } from '@nestjs/common';
import type { OfferValidationOutcome } from '../extraction/stage2-mechanical-validation';
import { resolveOffer, ResolvedOffer } from './resolve-offer';
import { ReviewDecision, reviewResolvedOffer } from './runtime-reviewer';

export interface ReviewedOffer {
  resolved: ResolvedOffer;
  review: ReviewDecision;
}

@Injectable()
export class ListingsService {
  resolve(outcome: OfferValidationOutcome): ResolvedOffer {
    return resolveOffer(outcome);
  }

  review(resolved: ResolvedOffer): ReviewDecision {
    return reviewResolvedOffer(resolved);
  }

  process(outcome: OfferValidationOutcome): ReviewedOffer {
    const resolved = this.resolve(outcome);
    return { resolved, review: this.review(resolved) };
  }
}
