import type { ExtractionResult } from './extraction-result.schema';

type Assertion = ExtractionResult['candidates'][0]['assertions'][number];

export type RejectedEvidence = {
  assertion: Assertion;
  reason: 'quote_not_in_source';
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
