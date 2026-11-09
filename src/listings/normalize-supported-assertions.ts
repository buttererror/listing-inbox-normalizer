import type { Assertion } from '../extraction/verify-verbatim-evidence';

type AreaKind = 'land' | 'built_up' | 'unspecified';
type Value =
  | { field: 'purpose'; value: 'sale' }
  | { field: 'property_type'; value: 'villa' | 'apartment' | 'studio' | 'land' | 'townhouse' | 'other' }
  | { field: 'bedrooms' | 'bathrooms'; value: number }
  | { field: 'area_sqm'; value: number; kind: AreaKind }
  | { field: 'price'; value: { amount: number; currency: 'SAR'; period: 'total' } }
  | { field: 'contact_phone' | 'city' | 'district'; value: string };

export type NormalizedAssertion = Value & { evidence: Assertion };
export type NormalizationFinding = { assertion: Assertion; reason: 'cannot_normalize' };

/** Input must already have passed Extraction's evidence and meaning checks. */
export function normalizeSupportedAssertions(assertions: readonly Assertion[]): {
  values: NormalizedAssertion[]; findings: NormalizationFinding[];
} {
  const values: NormalizedAssertion[] = [];
  const findings: NormalizationFinding[] = [];
  const sale = assertions.some(({ field, quote }) => field === 'purpose' && /(?:\b(?:for\s+sale|sale)\b|للبيع|بيع)/iu.test(quote));
  for (const assertion of assertions) {
    const value = normalize(assertion, sale);
    if (value) values.push({ ...value, evidence: assertion });
    else findings.push({ assertion, reason: 'cannot_normalize' });
  }
  return { values, findings };
}

function ascii(text: string): string {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, (digit) =>
    String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)))
    .replace(/٫/gu, '.').replace(/٬/gu, ',');
}

function numeric(raw: string): number | null {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/u.test(raw)) return null;
  const value = Number(raw.replace(/,/gu, ''));
  return Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
}

function normalize(assertion: Assertion, sale: boolean): Value | null {
  const { field } = assertion;
  const quote = ascii(assertion.quote);
  if (field === 'city' || field === 'district') {
    const label = field === 'city' ? /^(?:city|مدينة)\s*[:：]\s*(.+)$/iu : /^(?:district|neighbou?rhood|حي)\s*[:：]\s*(.+)$/iu;
    const match = assertion.quote.trim().match(label);
    const value = match?.[1].trim();
    return value && /^[\p{L}\p{M}\s'-]+$/u.test(value) ? { field, value } : null;
  }
  if (field === 'purpose') return /(?:\b(?:for\s+sale|sale)\b|للبيع|بيع)/iu.test(quote) ? { field, value: 'sale' } : null;
  if (field === 'property_type') {
    const matches: Array<[RegExp, 'villa' | 'apartment' | 'studio' | 'land' | 'townhouse' | 'other']> = [
      [/(?:\bvilla\b|فيلا)/iu, 'villa'], [/(?:\b(?:apartment|flat)\b|شقة)/iu, 'apartment'],
      [/(?:\bstudio\b|استوديو)/iu, 'studio'], [/(?:\bland\b|أرض|ارض)/iu, 'land'],
      [/(?:\btownhouse\b|تاون\s*هاوس)/iu, 'townhouse'], [/(?:\b(?:house|duplex)\b|دوبلكس)/iu, 'other'],
    ];
    const found = matches.filter(([pattern]) => pattern.test(quote));
    return found.length === 1 ? { field, value: found[0][1] } : null;
  }
  if (field === 'bedrooms' || field === 'bathrooms') {
    const cue = field === 'bedrooms' ? /(?:(?:\b|(?<=\d))(?:br|bedrooms?|beds?)\b|غرف(?:ة|\s+نوم)?)/iu : /(?:(?:\b|(?<=\d))(?:bathrooms?|baths?)\b|حمام(?:ات)?|دورات?\s+مياه|دورة\s+مياه)/iu;
    const numbers = quote.match(/\d+/gu);
    if (!cue.test(quote) || numbers?.length !== 1) return null;
    const value = Number(numbers[0]);
    return Number.isSafeInteger(value) ? { field, value } : null;
  }
  if (field === 'price') {
    if (!sale || !/(?:\bSAR\b|ريال(?:\s+سعودي)?)/iu.test(quote) || /(?:\b(?:USD|deposit|installment|monthly|yearly|rent|from|starting)\b|دولار|عربون|قسط|شهري|سنوي|إيجار|ايجار|يبدأ|(?:\/|\bper\s+)(?:\s*)(?:sqm|m2|m²|م²|متر)|للمتر)/iu.test(quote)) return null;
    const numbers = quote.match(/\d[\d,.]*/gu);
    if (numbers?.length !== 1) return null;
    const amount = numeric(numbers[0]);
    const tail = quote.slice(quote.indexOf(numbers[0]) + numbers[0].length);
    const currencyTail = tail.match(/^\s*(?:(million|m|مليون|ألف|الف|thousand|k)\s*)?(?:SAR\b|ريال(?:\s+سعودي)?)/iu);
    if (!currencyTail) return null;
    const suffix = currencyTail[1]?.toLowerCase();
    const multiplier = suffix && /^(?:million|m|مليون)$/iu.test(suffix) ? 1_000_000 : suffix ? 1_000 : 1;
    const result = amount === null ? null : amount * multiplier;
    return result !== null && Number.isFinite(result) && result <= Number.MAX_SAFE_INTEGER ? { field, value: { amount: result, currency: 'SAR', period: 'total' } } : null;
  }
  if (field === 'area_sqm') {
    if (!/(?:(?:\b|(?<=\d))(?:sqm|m2)\b|m²|م²|متر\s*مربع)/iu.test(quote)) return null;
    const numbers = quote.replace(/(?:\b|(?<=\d))m2\b/giu, 'sqm').match(/\d[\d,.]*/gu);
    if (numbers?.length !== 1) return null;
    const value = numeric(numbers[0]);
    const land = /(?:\bland\b|أرض|ارض)/iu.test(quote);
    const built = /(?:\bbuilt[ -]?up\b|\bbua\b|بناء|مبنية|مبنيه)/iu.test(quote);
    return value !== null && !(land && built) ? { field, value, kind: land ? 'land' : built ? 'built_up' : 'unspecified' } : null;
  }
  if (field === 'contact_phone') {
    if (!/(?:\b(?:call|contact|phone|mobile|whatsapp)\b|اتصل|تواصل|جوال|هاتف)/iu.test(quote)) return null;
    const numbers = quote.match(/(?:\+?\d[\d\s()-]*\d)/gu);
    if (numbers?.length !== 1) return null;
    const phone = numbers[0].replace(/[\s()-]/gu, '');
    const match = phone.match(/^(?:\+966|00966|966|0)(5\d{8})$/u);
    return match ? { field, value: `+966${match[1]}` } : null;
  }
  return null;
}

/** Select a priority group only; conflict resolution belongs to 02.5. */
export function selectAreaCandidates(values: readonly NormalizedAssertion[], propertyType: 'land' | 'built'): NormalizedAssertion[] {
  const areas = values.filter((item): item is NormalizedAssertion & { field: 'area_sqm' } => item.field === 'area_sqm');
  const priorities: AreaKind[] = propertyType === 'land' ? ['land', 'unspecified'] : ['built_up', 'unspecified', 'land'];
  for (const kind of priorities) {
    const group = areas.filter((item) => item.kind === kind);
    if (group.length) return group;
  }
  return [];
}
