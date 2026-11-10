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
