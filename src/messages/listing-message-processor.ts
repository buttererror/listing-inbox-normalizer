import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ExtractionService } from '../extraction/extraction.service';
import { ListingsService } from '../listings/listings.service';
import { MessageProcessor, MessageResult } from './message-processor';
import { ListingResult, MessageSuccess, messageSuccessSchema } from './message-result.schema';
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

    const { classification, detected_classes, offers } = outcome.result;

    const listings: ListingResult[] = offers.map((offer) => {
      const reviewed = this.listingsService.process(offer);
      const listingId = this.generateId();

      return {
        id: listingId,
        purpose: reviewed.resolved.fields.purpose,
        property_type: reviewed.resolved.fields.property_type,
        city: reviewed.resolved.fields.city,
        district: reviewed.resolved.fields.district,
        bedrooms: reviewed.resolved.fields.bedrooms,
        bathrooms: reviewed.resolved.fields.bathrooms,
        area_sqm: reviewed.resolved.fields.area_sqm,
        price: {
          amount: reviewed.resolved.fields.price.amount,
          currency: 'SAR',
          period: reviewed.resolved.fields.price.period,
        },
        contact_phone: reviewed.resolved.fields.contact_phone,
        needs_review: reviewed.review.needs_review,
        review_reasons: reviewed.review.review_reasons,
        duplicate_of: null,
      };
    });

    const success: MessageSuccess = {
      message_id: message.id,
      classification,
      detected_classes,
      listings,
    };

    return messageSuccessSchema.parse(success);
  }
}
