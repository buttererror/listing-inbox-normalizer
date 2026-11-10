import { Module } from '@nestjs/common';
import { MESSAGE_PROCESSOR } from './message-processor';
import { ListingMessageProcessor } from './listing-message-processor';
import { ExtractionModule } from '../extraction/extraction.module';

@Module({
  imports: [ExtractionModule],
  providers: [
    ListingMessageProcessor,
    { provide: MESSAGE_PROCESSOR, useExisting: ListingMessageProcessor },
  ],
  exports: [
    MESSAGE_PROCESSOR,
    ListingMessageProcessor,
  ],
})
export class MessagesModule {}
