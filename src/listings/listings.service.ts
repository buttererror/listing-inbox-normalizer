import { Injectable } from '@nestjs/common';
import type { Assertion } from '../extraction/verify-verbatim-evidence';
import type { RejectedEvidence } from '../extraction/verify-source-integrity';
import {
  normalizeSupportedAssertions,
  NormalizedAssertion,
  NormalizationFinding,
} from './normalize-supported-assertions';
import { resolveListing, ResolveListingInput, ResolvedListing } from './resolve-listing';

export type { ResolveListingInput, ResolvedListing };

@Injectable()
export class ListingsService {
  normalize(assertions: readonly Assertion[]): {
    values: NormalizedAssertion[];
    findings: NormalizationFinding[];
  } {
    return normalizeSupportedAssertions(assertions);
  }

  resolve(input: ResolveListingInput): ResolvedListing {
    return resolveListing(input);
  }

  process(
    id: string,
    assertions: readonly Assertion[],
    rejectedEvidence?: readonly RejectedEvidence[],
    duplicate_of?: string | null,
  ): ResolvedListing {
    const { values, findings } = this.normalize(assertions);
    return this.resolve({
      id,
      values,
      findings,
      rejectedEvidence,
      duplicate_of,
    });
  }
}
