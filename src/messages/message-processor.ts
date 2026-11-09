import { Stage1ExtractionResult } from '../extraction/extraction-result.schema';
import { MessageSuccess, ProcessingFailure } from './message-result.schema';
import { RawMessage } from './raw-message.schema';

export type MessageResult = MessageSuccess | ProcessingFailure | Stage1ExtractionResult;

export const MESSAGE_PROCESSOR = Symbol('MESSAGE_PROCESSOR');
export const LEGACY_MESSAGE_PROCESSOR = Symbol('LEGACY_MESSAGE_PROCESSOR');

export interface MessageProcessor {
  process(message: RawMessage): Promise<MessageResult>;
}
