import type { ExtractionAssertion, GatewayAssertion } from './extraction-result.schema';

export type RejectedReason =
  | 'quote_not_in_source'
  | 'context_not_in_source'
  | 'clipped_token'
  | 'multiple_occurrences'
  | 'field_contradicted'
  | 'field_uncertain';

export type RejectedEvidence = {
  assertion: ExtractionAssertion;
  reason: RejectedReason;
};

export interface SourceIntegrityOutcome {
  accepted: ExtractionAssertion[];
  rejectedEvidence: RejectedEvidence[];
}

export function isClippedToken(source: string, start: number, end: number): boolean {
  const isAlphaNum = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
  const isDigit = (ch: string) => /[\p{N}]/u.test(ch);
  const isSep = (ch: string) => /[.,\u066b\u066c]/.test(ch);
  const isSign = (ch: string) => /[+\-\u2212]/.test(ch);
  const isSlash = (ch: string) => ch === '/';

  const before = source[start - 1];
  const curr = source[start];
  const last = source[end - 1];
  const after = source[end];

  // In Arabic, the particle 'و' ('and') attaches directly to the following word without a space.
  // Starting right after 'و' does not cut an Arabic word.
  const attachedArabicConjunction = before === 'و' && /\p{Script=Arabic}/u.test(curr);

  // 1. Alphanumeric token cuts (inside a word or ungrouped number)
  if (before && !attachedArabicConjunction && isAlphaNum(before) && isAlphaNum(curr)) {
    return true;
  }
  if (after && isAlphaNum(after) && isAlphaNum(last)) {
    return true;
  }

  // 2. Cut through decimal or grouping separators on the left (e.g. "150,000", quote starts at "000" or ",000")
  if (isDigit(curr) && before && isSep(before) && start >= 2 && isDigit(source[start - 2])) {
    return true;
  }
  if (isSep(curr) && before && isDigit(before) && start + 1 < source.length && isDigit(source[start + 1])) {
    return true;
  }

  // 3. Cut through decimal or grouping separators on the right (e.g. "150,000", quote ends at "150" or "150,")
  if (isDigit(last) && after && isSep(after) && end + 1 < source.length && isDigit(source[end + 1])) {
    return true;
  }
  if (isSep(last) && after && isDigit(after) && end >= 2 && isDigit(source[end - 2])) {
    return true;
  }

  // 4. Signed number cuts (e.g. "-50,000" quoted as "50,000", cutting off leading sign)
  if (isDigit(curr) && before && isSign(before)) {
    return true;
  }
  if (isSign(last) && after && isDigit(after)) {
    return true;
  }

  // 5. Compound unit / rate slash cuts (e.g. "2,500 SAR/sqm" quoted as "2,500 SAR")
  if (isAlphaNum(last) && after && isSlash(after) && end + 1 < source.length && isAlphaNum(source[end + 1])) {
    return true;
  }
  if (isAlphaNum(curr) && before && isSlash(before) && start >= 2 && isAlphaNum(source[start - 2])) {
    return true;
  }

  return false;
}

export function findOccurrences(source: string, substring: string): Array<{ start: number; end: number }> {
  if (!substring) return [];
  const occurrences: Array<{ start: number; end: number }> = [];
  let from = 0;
  while (from <= source.length - substring.length) {
    const start = source.indexOf(substring, from);
    if (start === -1) break;
    occurrences.push({ start, end: start + substring.length });
    from = start + Math.max(substring.length, 1);
  }
  return occurrences;
}

export function verifySourceIntegrity(
  source: string,
  assertions: readonly GatewayAssertion[],
): SourceIntegrityOutcome {
  const accepted: ExtractionAssertion[] = [];
  const rejectedEvidence: RejectedEvidence[] = [];

  for (const raw of assertions) {
    const assertion: ExtractionAssertion = { field: raw.field, quote: raw.quote };

    // 1. Verify that the quote occurs in the original source
    if (!source.includes(raw.quote)) {
      rejectedEvidence.push({ assertion, reason: 'quote_not_in_source' });
      continue;
    }

    // 2. Check context_quote verbatim (no trim) whenever supplied
    const hasContext = raw.context_quote !== undefined && raw.context_quote !== null;
    if (hasContext) {
      if (!source.includes(raw.context_quote!) || !raw.context_quote!.includes(raw.quote)) {
        rejectedEvidence.push({ assertion, reason: 'context_not_in_source' });
        continue;
      }
    }

    // 3. Find occurrences and evaluate token boundaries & context containment
    const allOccurrences = findOccurrences(source, raw.quote);

    let candidateOccurrences: Array<{ start: number; end: number }>;
    if (hasContext) {
      const contextOccurrences = findOccurrences(source, raw.context_quote!);
      // Restrict quote occurrences to those contained within any occurrence of context_quote
      candidateOccurrences = allOccurrences.filter((occ) =>
        contextOccurrences.some((ctx) => occ.start >= ctx.start && occ.end <= ctx.end),
      );
    } else {
      candidateOccurrences = allOccurrences;
    }

    const unclippedOccurrences = candidateOccurrences.filter(
      (occ) => !isClippedToken(source, occ.start, occ.end),
    );

    if (unclippedOccurrences.length === 0) {
      rejectedEvidence.push({ assertion, reason: 'clipped_token' });
      continue;
    }

    // 4. Model verdict routing
    if (raw.verdict === 'contradicted') {
      rejectedEvidence.push({ assertion, reason: 'field_contradicted' });
      continue;
    }

    if (raw.verdict === 'uncertain') {
      rejectedEvidence.push({ assertion, reason: 'field_uncertain' });
      continue;
    }

    // 5. Supported verdict: must resolve to exactly one occurrence
    if (unclippedOccurrences.length > 1) {
      rejectedEvidence.push({ assertion, reason: 'multiple_occurrences' });
      continue;
    }

    // If context was supplied, ensure context itself appears uniquely in source
    if (hasContext) {
      const contextOccurrences = findOccurrences(source, raw.context_quote!);
      if (contextOccurrences.length > 1) {
        rejectedEvidence.push({ assertion, reason: 'multiple_occurrences' });
        continue;
      }
    }

    // Supported and passed all mechanical checks
    accepted.push(assertion);
  }

  return { accepted, rejectedEvidence };
}
