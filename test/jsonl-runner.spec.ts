import { runJsonl } from '../src/messages/jsonl-runner';
import { MessageProcessor } from '../src/messages/message-processor';

const message = {
  id: 'm-001', sender: '+966551234567', received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('JSONL runner', () => {
  const process = jest.fn<ReturnType<MessageProcessor['process']>, Parameters<MessageProcessor['process']>>();
  let output: string;

  beforeEach(() => {
    output = '';
    process.mockReset();
    process.mockImplementation(async (input) => ({ message_id: input.id, classification: 'listing', listings: [] }));
  });

  const run = (input: string) => runJsonl(input, { process }, (record) => { output += record; });
  const records = () => output.trim().split('\n').map((line) => JSON.parse(line));

  it('writes one JSON success and returns zero for a single message', async () => {
    expect(await run(JSON.stringify(message))).toBe(0);
    expect(records()).toEqual([{ message_id: 'm-001', classification: 'listing', listings: [] }]);
    expect(process).toHaveBeenCalledWith(message);
  });

  it('skips blank lines and continues in order after malformed JSON', async () => {
    const second = { ...message, id: 'm-002' };
    expect(await run(`${JSON.stringify(message)}\n  \n{bad\n${JSON.stringify(second)}\n`)).toBe(1);
    expect(records()).toEqual([
      { message_id: 'm-001', classification: 'listing', listings: [] },
      { message_id: null, error: { code: 'invalid_input', message: 'Invalid JSONL record' } },
      { message_id: 'm-002', classification: 'listing', listings: [] },
    ]);
    expect(process.mock.calls.map(([input]) => input.id)).toEqual(['m-001', 'm-002']);
  });

  it('rejects invalid messages without calling the processor and retains an available ID', async () => {
    const invalid = { ...message, id: 'm-003', received_at: 'yesterday' };
    const valid = { ...message, id: 'm-002' };
    expect(await run(`${JSON.stringify(invalid)}\n${JSON.stringify(valid)}`)).toBe(1);
    expect(records()).toEqual([
      { message_id: 'm-003', error: { code: 'invalid_input', message: 'Invalid message' } },
      { message_id: 'm-002', classification: 'listing', listings: [] },
    ]);
    expect(process).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(valid);
  });

  it('continues after a typed processor failure', async () => {
    process.mockResolvedValueOnce({ message_id: 'm-001', error: { code: 'provider_unavailable', message: 'Unavailable' } });
    expect(await run(`${JSON.stringify(message)}\n${JSON.stringify({ ...message, id: 'm-002' })}`)).toBe(1);
    expect(records()).toEqual([
      { message_id: 'm-001', error: { code: 'provider_unavailable', message: 'Unavailable' } },
      { message_id: 'm-002', classification: 'listing', listings: [] },
    ]);
  });

  it('converts unexpected processor exceptions to a safe failure and continues', async () => {
    process.mockRejectedValueOnce(new Error('private details'));
    expect(await run(`${JSON.stringify(message)}\n${JSON.stringify({ ...message, id: 'm-002' })}`)).toBe(1);
    expect(records()).toEqual([
      { message_id: 'm-001', error: { code: 'internal_error', message: 'Message processing failed' } },
      { message_id: 'm-002', classification: 'listing', listings: [] },
    ]);
  });

  it('emits nothing and returns zero for blank input', async () => {
    expect(await run('\n \r\n')).toBe(0);
    expect(output).toBe('');
    expect(process).not.toHaveBeenCalled();
  });
});
