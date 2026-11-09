import type { ExtractionAssertion } from './extraction-result.schema';
import type { RejectedReason } from './verify-source-integrity';

export type Assertion = ExtractionAssertion;
export type { RejectedReason };

export type RejectedEvidence = {
  assertion: Assertion;
  reason: RejectedReason;
};

export function verifyVerbatimEvidence(source: string, assertions: readonly Assertion[]) {
  const accepted: Assertion[] = [];
  const rejectedEvidence: RejectedEvidence[] = [];

  for (const assertion of assertions) {
    if (source.includes(assertion.quote)) {
      accepted.push(assertion);
    } else {
      rejectedEvidence.push({ assertion, reason: 'quote_not_in_source' });
    }
  }

  return { accepted, rejectedEvidence };
}
