import { Module } from '@nestjs/common';
import { MESSAGE_PROCESSOR } from './message-processor';
import { ListingMessageProcessor } from './listing-message-processor';
import { ExtractionModule } from '../extraction/extraction.module';
import { ListingsModule } from '../listings/listings.module';
import { DatabaseModule } from '../database/database.module';
import { PersistentIngestionService } from './persistent-ingestion.service';

@Module({
  imports: [ExtractionModule, ListingsModule, DatabaseModule],
  providers: [
    ListingMessageProcessor,
    PersistentIngestionService,
    { provide: MESSAGE_PROCESSOR, useExisting: ListingMessageProcessor },
  ],
  exports: [
    MESSAGE_PROCESSOR,
    ListingMessageProcessor,
    PersistentIngestionService,
  ],
})
export class MessagesModule {}
