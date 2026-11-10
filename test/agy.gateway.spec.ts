import { EventEmitter } from 'node:events';
import { AgyGateway } from '../src/llm-gateway/agy.gateway';
import { LlmRequest, ProviderError } from '../src/llm-gateway/llm-request';

const childProcess = require('node:child_process');

describe('AgyGateway', () => {
  const fakeRequest: LlmRequest = {
    instructions: 'Extract fields',
    sourceText: 'Villa for sale',
    responseSchema: { type: 'object' },
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes agy CLI and returns structured output', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = jest.fn();

    jest.spyOn(childProcess, 'spawn').mockReturnValue(fakeChild);

    const gateway = new AgyGateway({ executable: 'agy' });
    const promise = gateway.execute(fakeRequest);

    const payload = {
      status: 'SUCCESS',
      structured_output: { classification: 'listing', detected_classes: ['listing'], listings: [] },
    };

    fakeChild.stdout.emit('data', Buffer.from(JSON.stringify(payload)));
    fakeChild.emit('close', 0);

    const result = await promise;
    expect(result).toEqual({ classification: 'listing', detected_classes: ['listing'], listings: [] });
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
