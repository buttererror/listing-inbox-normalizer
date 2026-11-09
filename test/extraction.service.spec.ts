import { ExtractionService } from '../src/extraction/extraction.service';
import { LlmGateway } from '../src/llm-gateway/llm-request';

const message = {
  id: 'm-001', sender: 'broker', received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};
const gatewayCandidate = {
  assertions: [{ field: 'price', quote: 'Asking 3.2M SAR.', verdict: 'supported' as const }],
};

describe('ExtractionService', () => {
  it('sends the source, domain instructions and derived schema, then returns the candidate', async () => {
    const output = { classification: 'listing', candidates: [gatewayCandidate] };
    const execute = jest.fn<ReturnType<LlmGateway['execute']>, Parameters<LlmGateway['execute']>>().mockResolvedValue(output);
    const service = new ExtractionService({ execute });

    expect(await service.extract(message)).toEqual({
      ok: true,
      result: {
        classification: 'listing',
        candidates: [{ assertions: [{ field: 'price', quote: 'Asking 3.2M SAR.' }] }],
      },
      rejectedEvidence: [],
    });
    expect(execute).toHaveBeenCalledTimes(1);
    const request = execute.mock.calls[0][0];
    expect(request.sourceText).toBe(message.text);
    expect(request.instructions).toContain('shortest contiguous passage');
    expect(request.instructions).toContain('verdict');
    expect(request.responseSchema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['classification', 'candidates']),
      properties: { classification: { const: 'listing' } },
      additionalProperties: false,
    });
    expect(request.responseSchema).toMatchObject({
      properties: {
        candidates: {
          type: 'array',
          minItems: 1,
          maxItems: 1,
          items: { type: 'object' },
        },
      },
    });
    expect(request.responseSchema).toMatchObject({
      properties: {
        candidates: {
          items: {
            properties: {
              assertions: {
                items: {
                  required: expect.arrayContaining(['context_quote']),
                  properties: { context_quote: { type: expect.arrayContaining(['string', 'null']) } },
                },
              },
            },
          },
        },
      },
    });
  });

  it.each([
    { classification: 'listing', candidates: [{ assertions: [{ field: 'price', quote: 3, verdict: 'supported' }] }] },
    { classification: 'listing', candidates: [{ assertions: [{ field: 'price', quote: 'Asking 3.2M SAR.', verdict: 'invalid' }] }] },
    { classification: 'listing', candidates: [{ assertions: [{ field: 'price', quote: 'Asking 3.2M SAR.' }] }] },
    { classification: 'listing', candidates: [] },
    { classification: 'listing', candidates: [gatewayCandidate, gatewayCandidate] },
    { classification: 'buyer_request', candidates: [] },
  ])('returns an invalid extraction failure for malformed or unsupported output %#', async (output) => {
    const service = new ExtractionService({ execute: async () => output });
    expect(await service.extract(message)).toEqual({
      ok: false,
      failure: { message_id: message.id, error: { code: 'invalid_extraction', message: 'Invalid extraction response' } },
    });
  });
});
