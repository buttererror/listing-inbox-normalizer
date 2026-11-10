import { AiSdkGateway } from '../src/llm-gateway/ai-sdk.gateway';
import { createLlmGateway } from '../src/llm-gateway/llm-gateway.module';
import { parseTelemetry } from '../scripts/evaluate';

const extractionRequest = {
  instructions: 'Extract supported facts.',
  sourceText: 'Villa for sale for 3.2M SAR.',
  responseSchema: {
    type: 'object',
    properties: { classification: { type: 'string' } },
    required: ['classification'],
    additionalProperties: false,
  },
};

const extraction = { classification: 'listing' };

function providerConfig(provider: 'gemini' | 'anthropic' | 'openai', apiKey: string, model: string) {
  const base = {
    PORT: 3000,
    DATABASE_URL: 'file:./test.db',
    LLM_PROVIDER: provider,
    AGY_EXECUTABLE: 'agy',
    LLM_MODEL: model,
    LLM_TIMEOUT_MS: 1000,
  } as const;
  return { ...base, LLM_API_KEY: apiKey };
}

function googleResponse() {
  return new Response(JSON.stringify({
    candidates: [{
      finishReason: 'STOP',
      content: { role: 'model', parts: [{ text: JSON.stringify(extraction) }] },
    }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function anthropicResponse() {
  return new Response(JSON.stringify({
    id: 'message-1',
    type: 'message',
    role: 'assistant',
    model: 'claude-test',
    content: [{ type: 'text', text: JSON.stringify(extraction) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function openAiResponse() {
  return new Response(JSON.stringify({
    id: 'completion-1',
    object: 'chat.completion',
    created: 1,
    model: 'gpt-test',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: JSON.stringify(extraction) },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('AiSdkGateway', () => {
  const originalFetch = global.fetch;
  const originalTelemetry = process.env.DWELLEO_TELEMETRY;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalTelemetry === undefined) delete process.env.DWELLEO_TELEMETRY;
    else process.env.DWELLEO_TELEMETRY = originalTelemetry;
  });

  it.each([
    ['gemini', 'test-key', 'gemini-test', googleResponse, 'generativelanguage.googleapis.com', 'x-goog-api-key'],
    ['anthropic', 'test-key', 'claude-test', anthropicResponse, 'api.anthropic.com', 'x-api-key'],
    ['openai', 'test-key', 'gpt-test', openAiResponse, 'api.openai.com', 'authorization'],
  ] as const)('sends one structured, tool-free %s request', async (provider, apiKey, model, response, hostname, credentialHeader) => {
    const fetchMock = jest.fn().mockResolvedValue(response());
    global.fetch = fetchMock as typeof fetch;
    const gateway = await createLlmGateway(providerConfig(provider, apiKey, model));

    await expect(gateway.execute(extractionRequest)).resolves.toEqual(extraction);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    const body = JSON.parse(String(init.body));
    expect(String(url)).toContain(hostname);
    expect(headers.get(credentialHeader)).toContain('test-key');
    expect(`${String(url)}${JSON.stringify(body)}`).toContain(model);
    expect(JSON.stringify(body)).not.toContain('"tools"');
  });

  it('keeps instructions and source text in their provider message roles', async () => {
    const fetchMock = jest.fn().mockResolvedValue(googleResponse());
    global.fetch = fetchMock as typeof fetch;
    const gateway = await AiSdkGateway.create({
      provider: 'gemini', apiKey: 'test-key', model: 'gemini-test', timeoutMs: 1000,
    });

    await gateway.execute(extractionRequest);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toBe(extractionRequest.instructions);
    expect(body.contents[0].parts[0].text).toBe(extractionRequest.sourceText);
    expect(body.generationConfig.responseJsonSchema).toEqual(extractionRequest.responseSchema);
  });

  it('emits model usage and latency to stderr telemetry without changing model output', async () => {
    process.env.DWELLEO_TELEMETRY = '1';
    const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const fetchMock = jest.fn().mockResolvedValue(googleResponse());
    global.fetch = fetchMock as typeof fetch;
    const gateway = await AiSdkGateway.create({ provider: 'gemini', apiKey: 'test-key', model: 'gemini-test', timeoutMs: 1000 });

    await expect(gateway.execute({ ...extractionRequest, messageId: 'm-telemetry' })).resolves.toEqual(extraction);
    const telemetryLine = stderr.mock.calls.map(([chunk]) => String(chunk)).find((line) => line.startsWith('DWELLEO_TELEMETRY '));
    expect(telemetryLine).toBeDefined();
    expect(parseTelemetry(telemetryLine ?? '')[0]).toMatchObject({
      message_id: 'm-telemetry', provider: 'gemini', model: 'gemini-test', input_tokens: 1, output_tokens: 1, total_tokens: 2,
    });
    expect(parseTelemetry(telemetryLine ?? '')[0].duration_ms).toEqual(expect.any(Number));
  });

  it('emits failure telemetry and safely omits unavailable token usage', async () => {
    process.env.DWELLEO_TELEMETRY = '1';
    const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    global.fetch = jest.fn().mockResolvedValue(new Response('failure', { status: 500 })) as typeof fetch;
    const gateway = await AiSdkGateway.create({ provider: 'gemini', apiKey: 'test-key', model: 'gemini-test', timeoutMs: 1000 });
    await expect(gateway.execute({ ...extractionRequest, messageId: 'm-failed' })).rejects.toMatchObject({ code: 'provider_unavailable' });

    const line = stderr.mock.calls.map(([chunk]) => String(chunk)).find((entry) => entry.startsWith('DWELLEO_TELEMETRY '));
    expect(parseTelemetry(line ?? '')[0]).toMatchObject({ message_id: 'm-failed', error_code: 'provider_unavailable' });
    expect(parseTelemetry(line ?? '')[0]).not.toHaveProperty('input_tokens');
  });

  it('forces Anthropic native structured output', async () => {
    const fetchMock = jest.fn().mockResolvedValue(anthropicResponse());
    global.fetch = fetchMock as typeof fetch;
    const gateway = await AiSdkGateway.create({
      provider: 'anthropic', apiKey: 'test-key', model: 'claude-test', timeoutMs: 1000,
    });

    await gateway.execute(extractionRequest);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.tools).toBeUndefined();
  });

  it('uses strict JSON Schema for OpenAI', async () => {
    const fetchMock = jest.fn().mockResolvedValue(openAiResponse());
    global.fetch = fetchMock as typeof fetch;
    const gateway = await AiSdkGateway.create({
      provider: 'openai', apiKey: 'test-key', model: 'gpt-test', timeoutMs: 1000,
    });

    await gateway.execute(extractionRequest);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.tools).toBeUndefined();
  });

  it('returns invalid output for a malformed provider response', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: '{' }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    const gateway = await AiSdkGateway.create({
      provider: 'gemini', apiKey: 'test-key', model: 'gemini-test', timeoutMs: 1000,
    });

    await expect(gateway.execute(extractionRequest)).resolves.toBeUndefined();
  });

  it('maps provider failures and timeouts to typed failures', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('failure', { status: 500 })) as typeof fetch;
    const unavailable = await AiSdkGateway.create({
      provider: 'gemini', apiKey: 'test-key', model: 'gemini-test', timeoutMs: 1000,
    });
    await expect(unavailable.execute(extractionRequest)).rejects.toMatchObject({ code: 'provider_unavailable' });

    global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
    const timeout = await AiSdkGateway.create({
      provider: 'gemini', apiKey: 'test-key', model: 'gemini-test', timeoutMs: 1,
    });
    await expect(timeout.execute(extractionRequest)).rejects.toMatchObject({ code: 'provider_timeout' });
  });

  it('rejects incomplete provider configuration before a request', async () => {
    const gateway = await createLlmGateway({
      PORT: 3000,
      DATABASE_URL: 'file:./test.db',
      LLM_PROVIDER: 'openai',
      AGY_EXECUTABLE: 'agy',
      LLM_TIMEOUT_MS: 1000,
      LLM_API_KEY: 'test-key',
    });

    await expect(gateway.execute(extractionRequest)).rejects.toMatchObject({ code: 'provider_unavailable' });
  });
});
