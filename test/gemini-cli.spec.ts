import { join } from 'node:path';
import { createCliContext, runCli } from '../src/cli';

describe('AI SDK Gemini CLI wiring', () => {
  const originalFetch = global.fetch;
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnvironment };
  });

  it('sends the configured CLI message through the gateway and returns a listing', async () => {
    process.env.LLM_PROVIDER = 'gemini';
    process.env.LLM_MODEL = 'test-model';
    process.env.LLM_API_KEY = 'test-key';
    const extraction = {
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [
        {
          offer_quote: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
          candidates: [
            { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
            { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
            {
              field: 'price',
              value: { amount: 3200000, currency: 'SAR', period: 'total' },
              role: 'asking_price',
              quote: 'Asking 3.2M SAR',
              scope: 'local',
            },
          ],
          findings: [],
        },
      ],
    };
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(extraction) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
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
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [
        expect.objectContaining({
          offer_quote: expect.stringContaining('For sale'),
          candidates: expect.arrayContaining([
            expect.objectContaining({ field: 'property_type', value: 'villa' }),
            expect.objectContaining({
              field: 'price',
              value: { amount: 3200000, currency: 'SAR', period: 'total' },
            }),
          ]),
        }),
      ],
    });

    let legacyStdout = '';
    const exitLegacy = await runCli(['process-legacy', join(__dirname, 'fixtures/one-message.jsonl')], {
      createContext: createCliContext,
      stdout: (text) => { legacyStdout += text; },
      stderr: (text) => { stderr += text; },
    });
    expect(exitLegacy).toBe(0);
    expect(JSON.parse(legacyStdout)).toMatchObject({
      message_id: 'example-001',
      classification: 'listing',
      listings: [{ property_type: 'villa', price: { amount: 3200000, currency: 'SAR', period: 'total' } }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const request = JSON.parse(String(init.body));
    expect(url).toContain('/models/test-model:generateContent');
    expect(request.tools).toBeUndefined();
    expect(request.systemInstruction.parts[0].text).toContain("Dwelleo's extraction engine");
    expect(request.contents[0].parts[0].text).toContain('Asking 3.2M SAR');
  });
});
