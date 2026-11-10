import { MessageProcessor, MessageResult } from './message-processor';
import { ProcessingFailure, processingFailureSchema } from './message-result.schema';
import { extractCandidateMessageId, rawMessageSchema } from './raw-message.schema';

/** Process each nonblank JSONL line and write one result record in input order. */
export async function runJsonl(
  input: string,
  processor: MessageProcessor,
  writeResult: (record: string) => void,
): Promise<0 | 1> {
  let failed = false;

  for (const line of input.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    let parsed: unknown;
    let result: MessageResult;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      const failure: ProcessingFailure = {
        message_id: null,
        error: { code: 'invalid_input', message: 'Invalid JSONL record' },
      };
      writeResult(`${JSON.stringify(failure)}\n`);
      failed = true;
      continue;
    }

    const validated = rawMessageSchema.safeParse(parsed);
    if (!validated.success) {
      result = { message_id: extractCandidateMessageId(parsed), error: { code: 'invalid_input', message: 'Invalid message' } };
    } else {
      try {
        result = await processor.process(validated.data);
      } catch {
        result = { message_id: validated.data.id, error: { code: 'internal_error', message: 'Message processing failed' } };
      }
    }

    if (processingFailureSchema.safeParse(result).success) failed = true;
    writeResult(`${JSON.stringify(result)}\n`);
  }

  return failed ? 1 : 0;
}
