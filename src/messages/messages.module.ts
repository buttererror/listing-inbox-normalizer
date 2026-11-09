import { Module } from '@nestjs/common';
import { MESSAGE_PROCESSOR, MessageProcessor } from './message-processor';

const unavailableProcessor: MessageProcessor = {
  async process(message) {
    return {
      message_id: message.id,
      error: { code: 'provider_unavailable', message: 'Extraction is not configured' },
    };
  },
};

@Module({
  providers: [{ provide: MESSAGE_PROCESSOR, useValue: unavailableProcessor }],
  exports: [MESSAGE_PROCESSOR],
})
export class MessagesModule {}
