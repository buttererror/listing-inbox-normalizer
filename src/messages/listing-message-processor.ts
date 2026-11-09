import { Injectable } from '@nestjs/common';
import { ExtractionService } from '../extraction/extraction.service';
import { Stage1ExtractionResult } from '../extraction/extraction-result.schema';
import { MessageProcessor, MessageResult } from './message-processor';
import { RawMessage } from './raw-message.schema';

@Injectable()
export class ListingMessageProcessor implements MessageProcessor {
  constructor(private readonly extractionService: ExtractionService) {}

  async process(message: RawMessage): Promise<MessageResult> {
    const outcome = await this.extractionService.extract(message);
    if (!outcome.ok) {
      return outcome.failure;
    }

    const { classification, detected_classes, listings } = outcome.result;
    const envelope: Stage1ExtractionResult = {
      classification,
      detected_classes: detected_classes ?? [classification as any],
      listings: (listings ?? []).map((offer) => ({
        offer_quote: offer.offer_quote,
        candidates: offer.candidates,
        findings: offer.findings,
      })),
    };

    return envelope;
  }
}
