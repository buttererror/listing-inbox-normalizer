import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MESSAGE_PROCESSOR } from './message-processor';
import type { MessageResult, MessageProcessor } from './message-processor';
import { MessageSuccess, messageSuccessSchema } from './message-result.schema';
import { RawMessage } from './raw-message.schema';

/** HTTP-facing persistence boundary. The shared processor remains stateless. */
@Injectable()
export class PersistentIngestionService {
  constructor(
    @Inject(MESSAGE_PROCESSOR) private readonly processor: MessageProcessor,
    private readonly database: DatabaseService,
  ) {}

  async ingest(message: RawMessage): Promise<MessageResult> {
    const stored = await this.database.storedMessage.findUnique({ where: { id: message.id } });
    if (stored) return this.replayOrConflict(stored, message);

    const result = await this.processor.process(message);
    if (!this.isSuccess(result)) return result;

    try {
      await this.database.$transaction((tx) => tx.storedMessage.create({
        data: {
          id: message.id,
          sender: message.sender,
          receivedAt: message.received_at,
          text: message.text,
          classification: result.classification,
          detectedClasses: JSON.stringify(result.detected_classes),
          resultSnapshot: JSON.stringify(result),
          listings: {
            create: result.listings.map((listing, offerIndex) => ({
              id: listing.id,
              offerIndex,
              purpose: listing.purpose,
              propertyType: listing.property_type,
              city: listing.city,
              district: listing.district,
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              areaSqm: listing.area_sqm,
              priceAmount: listing.price.amount,
              priceCurrency: listing.price.currency,
              pricePeriod: listing.price.period,
              contactPhone: listing.contact_phone,
              needsReview: listing.needs_review,
              originallyNeedsReview: listing.needs_review,
              reviewReasons: JSON.stringify(listing.review_reasons),
              approvalState: 'pending',
              provenance: JSON.stringify({ listing }),
            })),
          },
        },
      }));
      return result;
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) {
        const winner = await this.database.storedMessage.findUnique({ where: { id: message.id } });
        if (winner) return this.replayOrConflict(winner, message);
      }
      throw error;
    }
  }

  private isSuccess(result: MessageResult): result is MessageSuccess {
    return messageSuccessSchema.safeParse(result).success;
  }

  private replayOrConflict(
    stored: { sender: string; receivedAt: string; text: string; resultSnapshot: string },
    message: RawMessage,
  ): MessageResult {
    if (stored.sender !== message.sender || stored.receivedAt !== message.received_at || stored.text !== message.text) {
      return { message_id: message.id, error: { code: 'message_conflict', message: 'Message ID conflicts with an existing message' } };
    }
    return messageSuccessSchema.parse(JSON.parse(stored.resultSnapshot));
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error
      && (error as { code: unknown }).code === 'P2002';
  }
}
