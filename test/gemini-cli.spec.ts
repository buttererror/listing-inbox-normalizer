import { join } from 'node:path';
import { createCliContext, runCli } from '../src/cli';

describe('Gemini CLI wiring', () => {
  const originalFetch = global.fetch;
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnvironment };
  });

  it('sends the configured CLI message through the gateway and returns a listing', async () => {
    process.env.LLM_PROVIDER = 'gemini';
    process.env.LLM_MODEL = 'test-model';
    process.env.GEMINI_API_KEY = 'test-key';
    const extraction = {
      classification: 'listing',
      candidates: [{
        assertions: [
          { field: 'purpose', quote: 'sale', verdict: 'supported' },
          { field: 'property_type', quote: 'Villa', verdict: 'supported' },
          { field: 'price', quote: 'Asking 3.2M SAR', verdict: 'supported' },
        ],
      }],
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(extraction) }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;
    let stdout = '';
    let stderr = '';

    const exit = await runCli(['process', join(__dirname, 'fixtures/one-message.jsonl')], {
      createContext: createCliContext,
      stdout: (text) => { stdout += text; },
      stderr: (text) => { stderr += text; },
    });

    expect(exit).toBe(0);
    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toMatchObject({
      message_id: 'example-001',
      classification: 'listing',
      listings: [{ property_type: 'villa', price: { amount: 3200000, currency: 'SAR', period: 'total' } }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.tools).toBeUndefined();
  });
});
