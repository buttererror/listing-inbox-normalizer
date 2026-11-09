import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ExtractionService } from '../extraction/extraction.service';
import { ListingsService } from '../listings/listings.service';
import { bridgeStage1SaleToBaseline } from './bridge-stage1-sale';
import { MessageProcessor, MessageResult } from './message-processor';
import { ListingResult, MessageSuccess } from './message-result.schema';
import { RawMessage } from './raw-message.schema';

@Injectable()
export class LegacyListingMessageProcessor implements MessageProcessor {
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

    const { result } = outcome;

    // 1. Non-listing single intents without offers: buyer requests, irrelevant, project without offers
    if (
      result.classification === 'buyer_request' ||
      result.classification === 'irrelevant' ||
      (result.classification === 'project' && (!result.listings || result.listings.length === 0))
    ) {
      return {
        message_id: message.id,
        classification: result.classification,
        listings: [],
      };
    }

    // 2. Unsafe for interim processor: mixed, multiple offers, or project with offers
    if (
      result.classification === 'mixed' ||
      (result.listings && result.listings.length > 1) ||
      (result.classification === 'project' && result.listings && result.listings.length > 0)
    ) {
      return {
        message_id: message.id,
        error: {
          code: 'internal_error',
          message: 'Interim processor only supports single sale listing assembly; multi-offer and mixed assembly deferred to 02.6',
        },
      };
    }

    // 3. For one independently identified sale offer
    if (result.listings && result.listings.length === 1) {
      const offer = result.listings[0];
      const hasTypedCandidates =
        offer.candidates.length > 0 &&
        typeof (offer.candidates[0] as any)?.scope === 'string';

      if (hasTypedCandidates) {
        const { accepted, rejectedEvidence } = bridgeStage1SaleToBaseline(message.text, offer);
        const combinedRejected = [
          ...(outcome.rejectedEvidence ?? []),
          ...rejectedEvidence,
        ];
        const listingId = this.generateId();
        const resolved = this.listingsService.process(
          listingId,
          accepted,
          combinedRejected,
          null,
        );
        const success: MessageSuccess = {
          message_id: message.id,
          classification: 'listing',
          listings: [resolved.listing],
        };
        return success;
      }
    }

    // Legacy fallback for tests mocking candidates directly
    if (result.candidates && result.candidates.length === 1) {
      const listingId = this.generateId();
      const resolved = this.listingsService.process(
        listingId,
        result.candidates[0].assertions as any,
        outcome.rejectedEvidence,
        null,
      );
      const success: MessageSuccess = {
        message_id: message.id,
        classification: 'listing',
        listings: [resolved.listing],
      };
      return success;
    }

    return {
      message_id: message.id,
      error: {
        code: 'internal_error',
        message: 'Interim processor only supports single sale listing assembly; multi-offer and mixed assembly deferred to 02.6',
      },
    };
  }
}
