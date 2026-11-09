import { GeminiGateway } from '../src/llm-gateway/gemini.gateway';

describe('GeminiGateway', () => {
  const originalFetch = global.fetch;
  const options = { apiKey: 'test-key', model: 'test-model', timeoutMs: 1000 };
  const request = {
    instructions: 'Extract facts',
    sourceText: 'Synthetic listing',
    responseSchema: {
      type: 'object',
      properties: { classification: { type: 'string', const: 'listing', minLength: 1 } },
      required: ['classification'],
      additionalProperties: false,
    },
  };

  afterEach(() => { global.fetch = originalFetch; });

  it('requests structured JSON with no model tools and returns the parsed result', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"classification":"listing"}' }] } }] }),
    });
    global.fetch = fetchMock as typeof fetch;
    await expect(new GeminiGateway(options).execute(request)).resolves.toEqual({ classification: 'listing' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/models/test-model:generateContent');
    const body = JSON.parse(init.body as string);
    expect(body.tools).toBeUndefined();
    expect(body.systemInstruction.parts[0].text).toBe(request.instructions);
    expect(body.contents[0].parts[0].text).toBe(request.sourceText);
    expect(body.generationConfig.responseJsonSchema.properties.classification).toEqual({
      type: 'string', enum: ['listing'],
    });
  });

  it.each([
    {},
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [null] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'invalid json' }] } }] },
  ])('returns an invalid intermediate response for malformed or incomplete output %#', async (body) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body }) as typeof fetch;
    await expect(new GeminiGateway(options).execute(request)).resolves.toBeUndefined();
  });

  it('maps HTTP failures without exposing provider response details', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as typeof fetch;
    await expect(new GeminiGateway(options).execute(request)).rejects.toMatchObject({
      code: 'provider_unavailable', message: 'Provider request failed',
    });
  });

  it('maps aborts to a provider timeout', async () => {
    global.fetch = jest.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
    await expect(new GeminiGateway({ ...options, timeoutMs: 10 }).execute(request)).rejects.toMatchObject({
      code: 'provider_timeout',
    });
  });
});
