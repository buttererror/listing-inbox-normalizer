import { ExtractionService } from '../src/extraction/extraction.service';
import type { GatewayAssertion } from '../src/extraction/extraction-result.schema';

const base = { id: 'm-001', sender: 'broker', received_at: '2026-11-01T09:12:00+03:00' };

async function extract(text: string, assertions: GatewayAssertion[]) {
  const execute = jest.fn().mockResolvedValue({ classification: 'listing', candidates: [{ assertions }] });
  const outcome = await new ExtractionService({ execute }).extract({ ...base, text });
  return { outcome, execute };
}

describe('propose evidence and assess meaning in one model call', () => {
  it('supports one Arabic phrase as property type and sale purpose', async () => {
    const assertions: GatewayAssertion[] = [
      { field: 'property_type', quote: 'فيلا للبيع', verdict: 'supported' },
      { field: 'purpose', quote: 'فيلا للبيع', verdict: 'supported' },
    ];
    const { outcome } = await extract('فرصة مميزة: فيلا للبيع في حي هادئ.', assertions);
    expect(outcome).toEqual({
      ok: true,
      result: {
        classification: 'listing',
        candidates: [{
          assertions: [
            { field: 'property_type', quote: 'فيلا للبيع' },
            { field: 'purpose', quote: 'فيلا للبيع' },
          ],
        }],
      },
      rejectedEvidence: [],
    });
  });

  it('contradicts a bedroom cue claimed as bathrooms', async () => {
    const bedroom: GatewayAssertion = { field: 'bedrooms', quote: '5 BR', verdict: 'supported' };
    const bathroom: GatewayAssertion = { field: 'bathrooms', quote: '5 BR', verdict: 'contradicted' };
    const { outcome } = await extract('A family villa for sale with 5 BR.', [bedroom, bathroom]);
    expect(outcome).toEqual({
      ok: true,
      result: { candidates: [{ assertions: [{ field: 'bedrooms', quote: '5 BR' }] }], classification: 'listing' },
      rejectedEvidence: [{ assertion: { field: 'bathrooms', quote: '5 BR' }, reason: 'field_contradicted' }],
    });
  });

  it('keeps unfamiliar and negated wording uncertain', async () => {
    const unfamiliar: GatewayAssertion = { field: 'bedrooms', quote: 'five sleeping chambers', verdict: 'uncertain' };
    const absent: GatewayAssertion = { field: 'bedrooms', quote: 'بدون غرف نوم', verdict: 'uncertain' };
    const { outcome } = await extract('five sleeping chambers، وبدون غرف نوم', [unfamiliar, absent]);
    expect(outcome).toMatchObject({
      ok: true,
      result: { candidates: [{ assertions: [] }] },
      rejectedEvidence: [
        { assertion: { field: 'bedrooms', quote: 'five sleeping chambers' }, reason: 'field_uncertain' },
        { assertion: { field: 'bedrooms', quote: 'بدون غرف نوم' }, reason: 'field_uncertain' },
      ],
    });
  });

  it.each([
    ['For sale. Deposit: 50,000 SAR.', 'Deposit: 50,000 SAR', undefined],
    ['Villa for sale. Asking 3.2M SAR per year.', 'Asking 3.2M SAR', 'Asking 3.2M SAR per year'],
    ['Villa for sale. السعر ٩٥٠ ألف ريال، دفعة أولى.', 'السعر ٩٥٠ ألف ريال', 'السعر ٩٥٠ ألف ريال، دفعة أولى'],
  ])('contradicts non-total price context in %s', async (text, quote, context_quote) => {
    const price: GatewayAssertion = { field: 'price', quote, verdict: 'contradicted', context_quote };
    const { outcome } = await extract(text, [price]);
    expect(outcome).toMatchObject({
      ok: true,
      result: { candidates: [{ assertions: [] }] },
      rejectedEvidence: [{ assertion: { field: 'price', quote }, reason: 'field_contradicted' }],
    });
  });

  it('rejects invented quotes and invented context', async () => {
    const inventedQuote: GatewayAssertion = { field: 'price', quote: 'Asking 4.5M SAR', verdict: 'supported' };
    const { outcome: quoteOutcome } = await extract('Villa for sale in Riyadh.', [inventedQuote]);
    expect(quoteOutcome).toMatchObject({
      rejectedEvidence: [{ assertion: { field: 'price', quote: 'Asking 4.5M SAR' }, reason: 'quote_not_in_source' }],
    });

    const inventedContext: GatewayAssertion = {
      field: 'city',
      quote: 'Riyadh',
      verdict: 'supported',
      context_quote: 'Located in Jeddah',
    };
    const { outcome: contextOutcome } = await extract('Villa for sale in Riyadh.', [inventedContext]);
    expect(contextOutcome).toMatchObject({
      rejectedEvidence: [{ assertion: { field: 'city', quote: 'Riyadh' }, reason: 'context_not_in_source' }],
    });

    const nonContainingContext: GatewayAssertion = {
      field: 'city',
      quote: 'Riyadh',
      verdict: 'supported',
      context_quote: 'Villa for sale',
    };
    const { outcome: nonContainingOutcome } = await extract('Villa for sale in Riyadh.', [nonContainingContext]);
    expect(nonContainingOutcome).toMatchObject({
      rejectedEvidence: [{ assertion: { field: 'city', quote: 'Riyadh' }, reason: 'context_not_in_source' }],
    });
  });

  it('checks context_quote verbatim without trimming', async () => {
    const paddedContext: GatewayAssertion = {
      field: 'city',
      quote: 'Riyadh',
      verdict: 'supported',
      context_quote: ' Riyadh ',
    };
    const { outcome: paddedOutcome } = await extract('Villa for sale in Riyadh.', [paddedContext]);
    expect(paddedOutcome).toMatchObject({
      rejectedEvidence: [{ assertion: { field: 'city', quote: 'Riyadh' }, reason: 'context_not_in_source' }],
    });

    const whitespaceOnlyContext: GatewayAssertion = {
      field: 'city',
      quote: 'Riyadh',
      verdict: 'supported',
      context_quote: '   ',
    };
    const { outcome: whitespaceOutcome } = await extract('Villa for sale in Riyadh.', [whitespaceOnlyContext]);
    expect(whitespaceOutcome).toMatchObject({
      rejectedEvidence: [{ assertion: { field: 'city', quote: 'Riyadh' }, reason: 'context_not_in_source' }],
    });
  });

  it('ties the context quote to the occurrence and rejects when that occurrence is clipped', async () => {
    const text = 'Deposit: 150,000 SAR; asking price: 50,000 SAR';
    const clippedInContext: GatewayAssertion = {
      field: 'price',
      quote: '50,000 SAR',
      verdict: 'supported',
      context_quote: 'Deposit: 150,000 SAR',
    };
    const { outcome: clippedOutcome } = await extract(text, [clippedInContext]);
    expect(clippedOutcome).toMatchObject({
      result: { candidates: [{ assertions: [] }] },
      rejectedEvidence: [{ assertion: { field: 'price', quote: '50,000 SAR' }, reason: 'clipped_token' }],
    });

    const unclippedInContext: GatewayAssertion = {
      field: 'price',
      quote: '50,000 SAR',
      verdict: 'supported',
      context_quote: 'asking price: 50,000 SAR',
    };
    const { outcome: unclippedOutcome } = await extract(text, [unclippedInContext]);
    expect(unclippedOutcome).toMatchObject({
      result: { candidates: [{ assertions: [{ field: 'price', quote: '50,000 SAR' }] }] },
      rejectedEvidence: [],
    });
  });

  it.each([
    ['Villa for sale, asking 150,000 SAR.', '50,000 SAR'],
    ['Villa for sale, asking 150,000 SAR.', '150'],
    ['Asking 3.2M SAR.', '3'],
    ['Asking 3.2M SAR.', '2M SAR'],
    ['Apartment for sale', 'partment'],
    ['Price: -50,000 SAR.', '50,000 SAR'],
    ['Price: +50,000 SAR.', '50,000 SAR'],
    ['Price: −50,000 SAR.', '50,000 SAR'],
    ['Rate: 2,500 SAR/sqm.', '2,500 SAR'],
    ['Rate: 2,500 SAR/m2.', '2,500 SAR'],
  ])('rejects clipped tokens in %s with quote %s', async (text, quote) => {
    const clipped: GatewayAssertion = { field: 'price', quote, verdict: 'supported' };
    const { outcome } = await extract(text, [clipped]);
    expect(outcome).toMatchObject({
      rejectedEvidence: [{ assertion: { field: 'price', quote }, reason: 'clipped_token' }],
    });
  });

  it('accepts unclipped signed numbers and compound rates when quoted completely', async () => {
    const signedNegative: GatewayAssertion = { field: 'price', quote: '-50,000 SAR', verdict: 'supported' };
    const { outcome: negativeOutcome } = await extract('Price: -50,000 SAR.', [signedNegative]);
    expect(negativeOutcome).toMatchObject({
      result: { candidates: [{ assertions: [{ field: 'price', quote: '-50,000 SAR' }] }] },
      rejectedEvidence: [],
    });

    const signedPositive: GatewayAssertion = { field: 'price', quote: '+50,000 SAR', verdict: 'supported' };
    const { outcome: positiveOutcome } = await extract('Price: +50,000 SAR.', [signedPositive]);
    expect(positiveOutcome).toMatchObject({
      result: { candidates: [{ assertions: [{ field: 'price', quote: '+50,000 SAR' }] }] },
      rejectedEvidence: [],
    });

    const fullRate: GatewayAssertion = { field: 'price', quote: '2,500 SAR/sqm', verdict: 'supported' };
    const { outcome: rateOutcome } = await extract('Rate: 2,500 SAR/sqm.', [fullRate]);
    expect(rateOutcome).toMatchObject({
      result: { candidates: [{ assertions: [{ field: 'price', quote: '2,500 SAR/sqm' }] }] },
      rejectedEvidence: [],
    });
  });

  it('marks repeated evidence without disambiguation as multiple_occurrences', async () => {
    const price: GatewayAssertion = { field: 'price', quote: '50,000 SAR', verdict: 'supported' };
    const { outcome } = await extract('Asking price 50,000 SAR; deposit 50,000 SAR.', [price]);
    expect(outcome).toMatchObject({
      result: { candidates: [{ assertions: [] }] },
      rejectedEvidence: [{ assertion: { field: 'price', quote: '50,000 SAR' }, reason: 'multiple_occurrences' }],
    });
  });

  it('allows a more specific quote to resolve repeated values', async () => {
    const price: GatewayAssertion = { field: 'price', quote: 'Asking price 50,000 SAR', verdict: 'supported' };
    const { outcome } = await extract('Asking price 50,000 SAR; deposit 50,000 SAR.', [price]);
    expect(outcome).toMatchObject({
      result: { candidates: [{ assertions: [{ field: 'price', quote: 'Asking price 50,000 SAR' }] }] },
      rejectedEvidence: [],
    });
  });

  it('allows a unique context_quote to distinguish repeated values', async () => {
    const price: GatewayAssertion = {
      field: 'price',
      quote: '50,000 SAR',
      verdict: 'supported',
      context_quote: 'Asking price 50,000 SAR;',
    };
    const { outcome } = await extract('Asking price 50,000 SAR; deposit 50,000 SAR.', [price]);
    expect(outcome).toMatchObject({
      result: { candidates: [{ assertions: [{ field: 'price', quote: '50,000 SAR' }] }] },
      rejectedEvidence: [],
    });
  });

  it('preserves mixed outcomes and calls the gateway once', async () => {
    const supported: GatewayAssertion = { field: 'bedrooms', quote: '3 bedrooms', verdict: 'supported' };
    const contradicted: GatewayAssertion = { field: 'bathrooms', quote: '3 bedrooms', verdict: 'contradicted' };
    const uncertain: GatewayAssertion = { field: 'city', quote: 'Al Malqa', verdict: 'uncertain' };
    const { outcome, execute } = await extract(
      'Villa for sale in Al Malqa with 3 bedrooms.',
      [supported, contradicted, uncertain],
    );
    expect(outcome).toEqual({
      ok: true,
      result: { classification: 'listing', candidates: [{ assertions: [{ field: 'bedrooms', quote: '3 bedrooms' }] }] },
      rejectedEvidence: [
        { assertion: { field: 'bathrooms', quote: '3 bedrooms' }, reason: 'field_contradicted' },
        { assertion: { field: 'city', quote: 'Al Malqa' }, reason: 'field_uncertain' },
      ],
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
