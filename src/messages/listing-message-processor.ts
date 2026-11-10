import { Injectable } from '@nestjs/common';
import { ExtractionService } from '../extraction/extraction.service';
import { Stage1ExtractionResult } from '../extraction/extraction-result.schema';
import { ListingsService } from '../listings/listings.service';
import { MessageProcessor, MessageResult } from './message-processor';
import { RawMessage } from './raw-message.schema';

@Injectable()
export class ListingMessageProcessor implements MessageProcessor {
  constructor(
    private readonly extractionService: ExtractionService,
    private readonly listingsService: ListingsService,
  ) {}

  async process(message: RawMessage): Promise<MessageResult> {
    const outcome = await this.extractionService.extract(message);
    if (!outcome.ok) {
      return outcome.failure;
    }

    const { classification, detected_classes, offers } = outcome.result;

    // Stage 6 has not yet assembled public listings. Still execute the complete
    // Stage 3 → Stage 5 handoff now, so every grounded offer follows typed
    // resolution and review rather than the retired single-sale quote parser.
    offers.forEach((offer) => this.listingsService.process(offer));

    const envelope: Stage1ExtractionResult = {
      classification,
      detected_classes,
      listings: offers.map((offer) => ({
        offer_quote: offer.offer_quote,
        candidates: offer.acceptedCandidates,
        findings: offer.semanticFindings,
      })),
    };

    return envelope;
  }
}
