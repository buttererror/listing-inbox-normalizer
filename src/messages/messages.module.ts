import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { MESSAGE_PROCESSOR } from './message-processor';
import { ListingMessageProcessor } from './listing-message-processor';
import { ExtractionModule } from '../extraction/extraction.module';
import { ListingsModule } from '../listings/listings.module';
import { DatabaseModule } from '../database/database.module';
import { PersistentIngestionService } from './persistent-ingestion.service';
import { MessagesController } from './messages.controller';
import { MessagesExceptionFilter } from './messages-exception.filter';

@Module({
  imports: [ExtractionModule, ListingsModule, DatabaseModule],
  controllers: [MessagesController],
  providers: [
    ListingMessageProcessor,
    PersistentIngestionService,
    { provide: MESSAGE_PROCESSOR, useExisting: ListingMessageProcessor },
    { provide: APP_FILTER, useClass: MessagesExceptionFilter },
  ],
  exports: [
    MESSAGE_PROCESSOR,
    ListingMessageProcessor,
    PersistentIngestionService,
  ],
})
export class MessagesModule {}
