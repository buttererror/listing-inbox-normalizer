import { stage1ExtractionResultSchema, validateExtractionEnvelope } from '../src/extraction/extraction-result.schema';
import { LlmGateway, LlmRequest } from '../src/llm-gateway/llm-request';
import { MessageProcessor } from '../src/messages/message-processor';

const message = {
  id: 'm-001', sender: '+966551234567', received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};
const candidate = {
  field: 'price',
  value: { amount: 3200000, currency: 'SAR', period: 'total' },
  role: 'asking_price',
  quote: 'Asking 3.2M SAR.',
  scope: 'local',
};
const extraction = {
  classification: 'listing',
  detected_classes: ['listing'],
  listings: [{ offer_quote: message.text, candidates: [candidate], findings: [] }],
};

describe('processing boundaries', () => {
  it('accepts success and failure processors through the same interface', async () => {
    const success: MessageProcessor = {
      process: async (input) => ({ message_id: input.id, classification: 'listing', listings: [] }),
    };
    const failure: MessageProcessor = {
      process: async (input) => ({ message_id: input.id, error: { code: 'provider_unavailable', message: 'Unavailable' } }),
    };
    expect(await success.process(message)).toEqual({ message_id: 'm-001', classification: 'listing', listings: [] });
    expect(await failure.process(message)).toEqual({ message_id: 'm-001', error: { code: 'provider_unavailable', message: 'Unavailable' } });
  });

  it('keeps gateway output unknown until validated and preserves typed candidates', async () => {
    const gateway: LlmGateway = { execute: async () => extraction };
    const request: LlmRequest = { instructions: 'Extract evidence', sourceText: message.text, responseSchema: {} };
    const output: unknown = await gateway.execute(request);
    expect(stage1ExtractionResultSchema.parse(output)).toEqual(extraction);
  });

  it.each([
    { field: 'price' },
    { ...candidate, quote: 1 },
    { ...candidate, quote: '' },
    { ...candidate, extra: true },
  ])('rejects malformed or non-strict typed candidates %#', (invalidCandidate) => {
    expect(stage1ExtractionResultSchema.safeParse({
      ...extraction,
      listings: [{ ...extraction.listings[0], candidates: [invalidCandidate] }],
    }).success).toBe(false);
  });

  it('rejects a listing envelope without an offer', () => {
    expect(validateExtractionEnvelope({ ...extraction, listings: [] }).ok).toBe(false);
  });

  it('rejects extra envelope and candidate properties', () => {
    expect(stage1ExtractionResultSchema.safeParse({ ...extraction, extra: true }).success).toBe(false);
    expect(stage1ExtractionResultSchema.safeParse({
      ...extraction,
      listings: [{ ...extraction.listings[0], extra: true }],
    }).success).toBe(false);
  });
});
