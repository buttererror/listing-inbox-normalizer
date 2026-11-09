import { MessageSuccess, ProcessingFailure } from './message-result.schema';
import { RawMessage } from './raw-message.schema';

export type MessageResult = MessageSuccess | ProcessingFailure;

export interface MessageProcessor {
  process(message: RawMessage): Promise<MessageResult>;
}
