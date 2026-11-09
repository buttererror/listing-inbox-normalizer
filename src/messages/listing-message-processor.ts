import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ExtractionService } from '../extraction/extraction.service';
import { ListingsService } from '../listings/listings.service';
import { MessageProcessor, MessageResult } from './message-processor';
import { ListingResult, MessageSuccess } from './message-result.schema';
import { RawMessage } from './raw-message.schema';

@Injectable()
export class ListingMessageProcessor implements MessageProcessor {
  private readonly generateId: () => string;

  constructor(
    private readonly extractionService: ExtractionService,
    private readonly listingsService: ListingsService,
    @Optional() generateId?: () => string,
  ) {
    this.generateId = generateId ?? randomUUID;
  }

  async process(message: RawMessage): Promise<MessageResult> {
    const outcome = await this.extractionService.extract(message);
    if (!outcome.ok) {
      return outcome.failure;
    }

    const { result, rejectedEvidence } = outcome;

    if (result.classification !== 'listing') {
      return {
        message_id: message.id,
        classification: result.classification,
        listings: [],
      };
    }

    const listings: ListingResult[] = result.candidates.map((candidate) => {
      const listingId = this.generateId();
      const resolved = this.listingsService.process(
        listingId,
        candidate.assertions,
        rejectedEvidence,
        null,
      );
      return resolved.listing;
    });

    const success: MessageSuccess = {
      message_id: message.id,
      classification: result.classification,
      listings,
    };

    return success;
  }
}
