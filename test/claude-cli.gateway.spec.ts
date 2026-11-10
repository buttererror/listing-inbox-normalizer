import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { createCliContext, runCli } from '../src/cli';
import { loadConfig } from '../src/config/env';
import { ClaudeCliGateway } from '../src/llm-gateway/claude-cli.gateway';
import { createLlmGateway } from '../src/llm-gateway/llm-gateway.module';
import { LlmRequest, ProviderError } from '../src/llm-gateway/llm-request';
import { parseTelemetry } from '../scripts/evaluate';

const childProcess = require('node:child_process');

function createMockChildProcess() {
  const fakeChild = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter & { end: jest.Mock; written: string };
    kill: jest.Mock;
  };
  fakeChild.stdout = new EventEmitter();
  fakeChild.stderr = new EventEmitter();
  const stdin = new EventEmitter() as EventEmitter & { end: jest.Mock; written: string };
  stdin.written = '';
  stdin.end = jest.fn((chunk?: string | Buffer) => {
    if (chunk !== undefined) {
      stdin.written += chunk.toString();
    }
  });
  fakeChild.stdin = stdin;
  fakeChild.kill = jest.fn();
  return fakeChild;
}

describe('ClaudeCliGateway', () => {
  const originalTelemetry = process.env.DWELLEO_TELEMETRY;
  const originalEnvironment = { ...process.env };
  const fakeRequest: LlmRequest = {
    messageId: 'claude-msg-01',
    instructions: 'Extract supported property fields.',
    sourceText: '- للبيع فيلا في الرياض ٣.٢ مليون ريال',
    responseSchema: { type: 'object', properties: { classification: { type: 'string' } } },
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    process.env = { ...originalEnvironment };
    if (originalTelemetry === undefined) delete process.env.DWELLEO_TELEMETRY;
    else process.env.DWELLEO_TELEMETRY = originalTelemetry;
  });

  it('invokes claude CLI in tool-less print mode, sends sourceText on stdin, and emits telemetry', async () => {
    process.env.DWELLEO_TELEMETRY = '1';
    const stderrMock = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const fakeChild = createMockChildProcess();
    const spawnSpy = jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new ClaudeCliGateway({
      executable: '/usr/local/bin/claude',
      model: 'sonnet',
      timeoutMs: 12000,
    });
    const promise = gateway.execute(fakeRequest);

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    const [executable, args, options] = spawnSpy.mock.calls[0] as [string, string[], { cwd?: string }];
    expect(executable).toBe('/usr/local/bin/claude');
    expect(options.cwd).toBe(os.tmpdir());
    expect(args).toEqual(
      expect.arrayContaining([
        '-p',
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(fakeRequest.responseSchema),
        '--system-prompt',
        fakeRequest.instructions,
        '--tools',
        '',
        '--strict-mcp-config',
        '--disable-slash-commands',
        '--no-session-persistence',
        '--model',
        'sonnet',
      ]),
    );
    expect(fakeChild.stdin.end).toHaveBeenCalledTimes(1);
    expect(fakeChild.stdin.written).toContain(fakeRequest.sourceText);

    const payload = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 2150.4,
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 300,
        output_tokens: 80,
      },
      structured_output: { classification: 'listing', detected_classes: ['listing'], listings: [] },
    };

    fakeChild.stdout.emit('data', Buffer.from(JSON.stringify(payload)));
    fakeChild.emit('close', 0);

    await expect(promise).resolves.toEqual({
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [],
    });

    const telemetryLine = stderrMock.mock.calls
      .map(([chunk]) => String(chunk))
      .find((line) => line.startsWith('DWELLEO_TELEMETRY '));
    expect(telemetryLine).toBeDefined();
    expect(parseTelemetry(telemetryLine ?? '')[0]).toMatchObject({
      message_id: 'claude-msg-01',
      provider: 'claude-cli',
      model: 'sonnet',
      duration_ms: 2150.4,
      input_tokens: 420,
      output_tokens: 80,
      total_tokens: 500,
    });
  });

  it('falls back to parsing fenced JSON from result and resolves model from modelUsage when omitted', async () => {
    process.env.DWELLEO_TELEMETRY = '1';
    const stderrMock = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const fakeChild = createMockChildProcess();
    const spawnSpy = jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new ClaudeCliGateway({ executable: 'claude' });
    const promise = gateway.execute(fakeRequest);

    const [, args] = spawnSpy.mock.calls[0] as [string, string[]];
    expect(args).not.toContain('--model');

    fakeChild.stdout.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: false,
          modelUsage: { 'claude-sonnet-4-6': { inputTokens: 10, outputTokens: 5 } },
          result: '```json\n{"classification":"irrelevant","detected_classes":["irrelevant"],"listings":[]}\n```',
        }),
      ),
    );
    fakeChild.emit('close', 0);

    await expect(promise).resolves.toEqual({
      classification: 'irrelevant',
      detected_classes: ['irrelevant'],
      listings: [],
    });

    const telemetryLine = stderrMock.mock.calls
      .map(([chunk]) => String(chunk))
      .find((line) => line.startsWith('DWELLEO_TELEMETRY '));
    expect(parseTelemetry(telemetryLine ?? '')[0]).toMatchObject({
      provider: 'claude-cli',
      model: 'claude-sonnet-4-6',
    });
  });

  it('returns undefined on error_max_structured_output_retries without structured_output', async () => {
    const fakeChild = createMockChildProcess();
    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new ClaudeCliGateway();
    const promise = gateway.execute(fakeRequest);

    fakeChild.stdout.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          type: 'result',
          subtype: 'error_max_structured_output_retries',
          is_error: true,
          errors: ['Failed to provide valid structured output after 5 attempts'],
        }),
      ),
    );
    fakeChild.emit('close', 0);

    await expect(promise).resolves.toBeUndefined();
  });

  it('throws provider_unavailable when envelope indicates is_error or invalid JSON', async () => {
    const errorChild = createMockChildProcess();
    jest.spyOn(childProcess, 'spawn').mockReturnValueOnce(errorChild);

    const gateway = new ClaudeCliGateway();
    const errorPromise = gateway.execute(fakeRequest);
    errorChild.stdout.emit(
      'data',
      Buffer.from(JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in. Please run /login' })),
    );
    errorChild.emit('close', 0);

    await expect(errorPromise).rejects.toMatchObject({
      code: 'provider_unavailable',
      message: expect.stringContaining('Not logged in'),
    });

    const badJsonChild = createMockChildProcess();
    jest.spyOn(childProcess, 'spawn').mockReturnValueOnce(badJsonChild);
    const badJsonPromise = gateway.execute(fakeRequest);
    badJsonChild.stdout.emit('data', Buffer.from('not-json'));
    badJsonChild.emit('close', 0);

    await expect(badJsonPromise).rejects.toBeInstanceOf(ProviderError);
    await expect(badJsonPromise).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('throws provider_unavailable on spawn error (without unhandled EPIPE) and non-zero exit', async () => {
    const enoentChild = createMockChildProcess();
    jest.spyOn(childProcess, 'spawn').mockReturnValueOnce(enoentChild);

    const gateway = new ClaudeCliGateway({ executable: 'missing-claude' });
    const enoentPromise = gateway.execute(fakeRequest);
    enoentChild.stdin.emit('error', new Error('write EPIPE'));
    enoentChild.emit('error', new Error('spawn missing-claude ENOENT'));

    await expect(enoentPromise).rejects.toMatchObject({ code: 'provider_unavailable' });

    const exitChild = createMockChildProcess();
    jest.spyOn(childProcess, 'spawn').mockReturnValueOnce(exitChild);
    const exitPromise = gateway.execute(fakeRequest);
    exitChild.stderr.emit('data', Buffer.from('authentication required'));
    exitChild.emit('close', 1);

    await expect(exitPromise).rejects.toMatchObject({
      code: 'provider_unavailable',
      message: expect.stringContaining('exited with code 1'),
    });
  });

  it('kills the child process and throws provider_timeout when timeoutMs expires', async () => {
    jest.useFakeTimers();
    process.env.DWELLEO_TELEMETRY = '1';
    const stderrMock = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const fakeChild = createMockChildProcess();
    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new ClaudeCliGateway({ timeoutMs: 250 });
    const promise = gateway.execute(fakeRequest);

    jest.advanceTimersByTime(250);
    expect(fakeChild.kill).toHaveBeenCalledWith('SIGKILL');
    fakeChild.emit('close', null);

    await expect(promise).rejects.toMatchObject({ code: 'provider_timeout' });

    const telemetryLine = stderrMock.mock.calls
      .map(([chunk]) => String(chunk))
      .find((line) => line.startsWith('DWELLEO_TELEMETRY '));
    expect(parseTelemetry(telemetryLine ?? '')[0]).toMatchObject({
      provider: 'claude-cli',
      error_code: 'provider_timeout',
    });
  });

  it.each(['claude-cli', 'claude'] as const)(
    'wires %s through createLlmGateway without LLM_API_KEY and runs end-to-end CLI processing',
    async (provider) => {
      const tempDbDir = mkdtempSync(join(os.tmpdir(), 'dwelleo-claude-cli-'));
      process.env.DATABASE_URL = `file:${join(tempDbDir, 'test.db')}`;
      execFileSync('pnpm', ['--silent', 'run', 'db:deploy'], { cwd: process.cwd(), env: process.env, stdio: 'pipe' });
      process.env.LLM_PROVIDER = provider;
      process.env.CLAUDE_EXECUTABLE = 'claude';
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_MODEL;

      try {
        const config = loadConfig(process.env);
        const gateway = await createLlmGateway(config);
        expect(gateway).toBeInstanceOf(ClaudeCliGateway);

        const fakeChild = createMockChildProcess();
        jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

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

        let stdout = '';
        let stderr = '';
        const cliPromise = runCli(['process', join(__dirname, 'fixtures/one-message.jsonl')], {
          createContext: createCliContext,
          stdout: (text) => {
            stdout += text;
          },
          stderr: (text) => {
            stderr += text;
          },
        });

        // Wait for NestJS bootstrap and spawn call.
        for (let attempt = 0; attempt < 20 && (childProcess.spawn as jest.Mock).mock.calls.length === 0; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        fakeChild.stdout.emit(
          'data',
          Buffer.from(JSON.stringify({ type: 'result', is_error: false, structured_output: extraction })),
        );
        fakeChild.emit('close', 0);

        const exit = await cliPromise;
        expect(exit).toBe(0);
        expect(stderr).toBe('');
        expect(JSON.parse(stdout)).toMatchObject({
          message_id: 'example-001',
          classification: 'listing',
          detected_classes: ['listing'],
          listings: [
            expect.objectContaining({
              purpose: 'sale',
              property_type: 'villa',
              price: { amount: 3200000, currency: 'SAR', period: 'total' },
            }),
          ],
        });
      } finally {
        rmSync(tempDbDir, { recursive: true, force: true });
      }
    },
  );
});
