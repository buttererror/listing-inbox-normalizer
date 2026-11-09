import { Module } from '@nestjs/common';
import { LEGACY_MESSAGE_PROCESSOR, MESSAGE_PROCESSOR } from './message-processor';
import { LegacyListingMessageProcessor } from './legacy-listing-message-processor';
import { ListingMessageProcessor } from './listing-message-processor';
import { ExtractionModule } from '../extraction/extraction.module';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ExtractionModule, ListingsModule],
  providers: [
    ListingMessageProcessor,
    LegacyListingMessageProcessor,
    { provide: MESSAGE_PROCESSOR, useExisting: ListingMessageProcessor },
    { provide: LEGACY_MESSAGE_PROCESSOR, useExisting: LegacyListingMessageProcessor },
  ],
  exports: [
    MESSAGE_PROCESSOR,
    LEGACY_MESSAGE_PROCESSOR,
    ListingMessageProcessor,
    LegacyListingMessageProcessor,
  ],
})
export class MessagesModule {}

