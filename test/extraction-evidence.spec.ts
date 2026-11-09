import { ExtractionService } from '../src/extraction/extraction.service';

const message = {
  id: 'm-002', sender: 'broker', received_at: '2026-11-01T09:12:00+03:00',
  text: 'للبيع شقة. السعر ٩٥٠ ألف ريال.',
};

describe('verbatim extraction evidence', () => {
  it('keeps matching assertions and retains invented quotes with a finding', async () => {
    const valid = { field: 'purpose', quote: 'للبيع', verdict: 'supported' as const };
    const invented = { field: 'price', quote: 'السعر 980 ألف ريال.', verdict: 'supported' as const };
    const service = new ExtractionService({
      execute: async () => ({ classification: 'listing', candidates: [{ assertions: [valid, invented] }] }),
    });

    expect(await service.extract(message)).toEqual({
      ok: true,
      result: { classification: 'listing', candidates: [{ assertions: [{ field: 'purpose', quote: 'للبيع' }] }] },
      rejectedEvidence: [{ assertion: { field: 'price', quote: 'السعر 980 ألف ريال.' }, reason: 'quote_not_in_source' }],
    });
  });

  it('does not normalize digits before comparing a quote', async () => {
    const altered = { field: 'price', quote: 'السعر 950 ألف ريال.', verdict: 'supported' as const };
    const service = new ExtractionService({
      execute: async () => ({ classification: 'listing', candidates: [{ assertions: [altered] }] }),
    });

    expect(await service.extract(message)).toEqual({
      ok: true,
      result: { classification: 'listing', candidates: [{ assertions: [] }] },
      rejectedEvidence: [{ assertion: { field: 'price', quote: 'السعر 950 ألف ريال.' }, reason: 'quote_not_in_source' }],
    });
  });

  it('retains repeated assertions and checks each one independently', async () => {
    const quote = { field: 'price', quote: 'السعر ٩٥٠ ألف ريال.', verdict: 'supported' as const };
    const service = new ExtractionService({
      execute: async () => ({ classification: 'listing', candidates: [{ assertions: [quote, quote] }] }),
    });

    expect(await service.extract(message)).toEqual({
      ok: true,
      result: {
        classification: 'listing',
        candidates: [{ assertions: [{ field: 'price', quote: 'السعر ٩٥٠ ألف ريال.' }, { field: 'price', quote: 'السعر ٩٥٠ ألف ريال.' }] }],
      },
      rejectedEvidence: [],
    });
  });
});
