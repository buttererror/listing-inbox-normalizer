import { normalizeSupportedAssertions, selectAreaCandidates } from '../src/listings/normalize-supported-assertions';

const sale = { field: 'purpose', quote: 'للبيع' };

describe('normalization of supported assertions', () => {
  it('handles attached units and negotiable asking prices', () => {
    const result = normalizeSupportedAssertions([sale, { field: 'bedrooms', quote: '3BR' }, { field: 'area_sqm', quote: '380m2 built-up' }, { field: 'price', quote: 'Price 3.2M SAR negotiable' }]);
    expect(result.findings).toEqual([]);
    expect(result.values.slice(1).map((item) => item.value)).toEqual([3, 380, { amount: 3200000, currency: 'SAR', period: 'total' }]);
  });

  it.each(['2,500 SAR/sqm', '2,500 SAR per m2', 'deposit 250,000 SAR', 'from 250,000 SAR'])('does not treat %s as a total asking price', (quote) => {
    expect(normalizeSupportedAssertions([sale, { field: 'price', quote }]).findings).toHaveLength(1);
  });

  it('uses explicitly labelled location evidence', () => {
    const result = normalizeSupportedAssertions([{ field: 'city', quote: 'City: Riyadh' }, { field: 'district', quote: 'حي: النرجس' }, { field: 'city', quote: 'Al Malqa' }]);
    expect(result.values.map((item) => item.value)).toEqual(['Riyadh', 'النرجس']);
    expect(result.findings).toHaveLength(1);
  });
  it('normalizes Arabic digits, sale price and offered mobile while preserving quotes', () => {
    const assertions = [sale, { field: 'bedrooms', quote: '٣ غرف نوم' }, { field: 'price', quote: '٩٥٠ ألف ريال' }, { field: 'contact_phone', quote: 'للتواصل: ٠٥٥١٢٣٤٥٦٧' }];
    const result = normalizeSupportedAssertions(assertions);
    expect(result.findings).toEqual([]);
    expect(result.values).toEqual([
      { field: 'purpose', value: 'sale', evidence: assertions[0] },
      { field: 'bedrooms', value: 3, evidence: assertions[1] },
      { field: 'price', value: { amount: 950000, currency: 'SAR', period: 'total' }, evidence: assertions[2] },
      { field: 'contact_phone', value: '+966551234567', evidence: assertions[3] },
    ]);
  });

  it.each(['3.2M SAR', '3,200,000 SAR'])('converts %s', (quote) => {
    const result = normalizeSupportedAssertions([sale, { field: 'price', quote }]);
    expect(result.values[1]).toMatchObject({ value: { amount: 3200000, currency: 'SAR', period: 'total' } });
  });

  it.each(['250,000 USD', '250,000', '3,20 SAR'])('retains a finding for %s', (quote) => {
    const assertion = { field: 'price', quote };
    const result = normalizeSupportedAssertions([sale, assertion]);
    expect(result.values).toHaveLength(1);
    expect(result.findings).toEqual([{ assertion, reason: 'cannot_normalize' }]);
  });

  it('selects the approved area priority and preserves competing evidence', () => {
    const assertions = [{ field: 'area_sqm', quote: 'land area 450 sqm' }, { field: 'area_sqm', quote: 'built-up area 380 sqm' }, { field: 'area_sqm', quote: 'built-up area 390 m2' }];
    const { values } = normalizeSupportedAssertions(assertions);
    expect(selectAreaCandidates(values, 'built')).toEqual([
      { field: 'area_sqm', value: 380, kind: 'built_up', evidence: assertions[1] },
      { field: 'area_sqm', value: 390, kind: 'built_up', evidence: assertions[2] },
    ]);
    expect(selectAreaCandidates(values, 'land')).toEqual([{ field: 'area_sqm', value: 450, kind: 'land', evidence: assertions[0] }]);
  });

  it('keeps competing prices distinct and requires sale evidence', () => {
    const prices = [{ field: 'price', quote: '3.2M SAR' }, { field: 'price', quote: '3,200,001 SAR' }];
    expect(normalizeSupportedAssertions([sale, ...prices]).values.slice(1).map((v) => v.evidence)).toEqual(prices);
    expect(normalizeSupportedAssertions(prices).findings).toHaveLength(2);
  });

  it('does not infer an omitted contact qualifier', () => {
    expect(normalizeSupportedAssertions([{ field: 'contact_phone', quote: '0551234567' }]).findings).toHaveLength(1);
  });

  it.each(['+966 55 123 4567', '00966-55-123-4567'])('formats %s', (quote) => {
    expect(normalizeSupportedAssertions([{ field: 'contact_phone', quote: `Call ${quote}` }]).values[0]).toMatchObject({ value: '+966551234567' });
  });
});
