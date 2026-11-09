import { extractionResultSchema } from '../src/extraction/extraction-result.schema';
import { LlmGateway, LlmRequest } from '../src/llm-gateway/llm-request';
import { MessageProcessor } from '../src/messages/message-processor';

const message = {
  id: 'm-001', sender: '+966551234567', received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};
const candidate = { assertions: [{ field: 'price', quote: 'Asking 3.2M SAR.' }] };
const extraction = { classification: 'listing', candidates: [candidate] };

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

  it('keeps gateway output unknown until validated and preserves assertions', async () => {
    const gateway: LlmGateway = { execute: async () => extraction };
    const request: LlmRequest = { instructions: 'Extract evidence', sourceText: message.text, responseSchema: {} };
    const output: unknown = await gateway.execute(request);
    expect(extractionResultSchema.parse(output)).toEqual(extraction);
  });

  it.each([
    { assertions: [{ field: 'price' }] },
    { assertions: [{ field: 'price', quote: 1 }] },
    { assertions: [{ field: 'price', quote: '' }] },
    { assertions: [{ field: 'price', quote: 'Price', extra: true }] },
  ])('rejects malformed or non-strict assertions %#', (invalidCandidate) => {
    expect(extractionResultSchema.safeParse({ ...extraction, candidates: [invalidCandidate] }).success).toBe(false);
  });

  it.each([{ candidates: [] }, { candidates: [candidate, candidate] }])('rejects unsupported candidate counts', ({ candidates }) => {
    expect(extractionResultSchema.safeParse({ ...extraction, candidates }).success).toBe(false);
  });

  it('rejects extra envelope and candidate properties', () => {
    expect(extractionResultSchema.safeParse({ ...extraction, extra: true }).success).toBe(false);
    expect(extractionResultSchema.safeParse({ ...extraction, candidates: [{ ...candidate, extra: true }] }).success).toBe(false);
  });
});
