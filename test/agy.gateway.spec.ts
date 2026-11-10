import { EventEmitter } from 'node:events';
import { AgyGateway } from '../src/llm-gateway/agy.gateway';
import { LlmRequest, ProviderError } from '../src/llm-gateway/llm-request';
import { parseTelemetry } from '../scripts/evaluate';

const childProcess = require('node:child_process');

describe('AgyGateway', () => {
  const originalTelemetry = process.env.DWELLEO_TELEMETRY;
  const fakeRequest: LlmRequest = {
    messageId: 'agy-msg-01',
    instructions: 'Extract fields',
    sourceText: 'Villa for sale',
    responseSchema: { type: 'object' },
  };

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalTelemetry === undefined) delete process.env.DWELLEO_TELEMETRY;
    else process.env.DWELLEO_TELEMETRY = originalTelemetry;
  });

  it('executes agy CLI and returns structured output with telemetry', async () => {
    process.env.DWELLEO_TELEMETRY = '1';
    const stderrMock = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = jest.fn();

    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new AgyGateway({ executable: 'agy', model: 'gemini-2.5-flash' });
    const promise = gateway.execute(fakeRequest);

    const payload = {
      status: 'SUCCESS',
      duration_seconds: 1.45,
      usage: { input_tokens: 120, output_tokens: 45, total_tokens: 165 },
      structured_output: { classification: 'listing', detected_classes: ['listing'], listings: [] },
    };

    fakeChild.stdout.emit('data', Buffer.from(JSON.stringify(payload)));
    fakeChild.emit('close', 0);

    const result = await promise;
    expect(result).toEqual({ classification: 'listing', detected_classes: ['listing'], listings: [] });

    const telemetryLines = stderrMock.mock.calls
      .map(([chunk]) => String(chunk))
      .filter((line) => line.startsWith('DWELLEO_TELEMETRY '));
    expect(telemetryLines.length).toBe(1);

    const records = parseTelemetry(telemetryLines[0]);
    expect(records[0]).toMatchObject({
      message_id: 'agy-msg-01',
      provider: 'agy',
      model: 'gemini-2.5-flash',
      duration_ms: 1450,
      input_tokens: 120,
      output_tokens: 45,
      total_tokens: 165,
    });
  });

  it('parses JSON string response when structured_output is not present', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = jest.fn();

    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new AgyGateway({ executable: 'agy' });
    const promise = gateway.execute(fakeRequest);

    const payload = {
      status: 'SUCCESS',
      response: JSON.stringify({ classification: 'buyer_request', detected_classes: ['buyer_request'], listings: [] }),
    };

    fakeChild.stdout.emit('data', Buffer.from(JSON.stringify(payload)));
    fakeChild.emit('close', 0);

    const result = await promise;
    expect(result).toEqual({ classification: 'buyer_request', detected_classes: ['buyer_request'], listings: [] });
  });

  it('throws provider_unavailable when child process errors', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = jest.fn();

    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new AgyGateway({ executable: 'non-existent-agy' });
    const promise = gateway.execute(fakeRequest);

    fakeChild.emit('error', new Error('spawn ENOENT'));

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('throws provider_unavailable on non-zero exit code', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = jest.fn();

    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new AgyGateway({ executable: 'agy' });
    const promise = gateway.execute(fakeRequest);

    fakeChild.stderr.emit('data', Buffer.from('model not found'));
    fakeChild.emit('close', 1);

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({ code: 'provider_unavailable' });
  });
});
