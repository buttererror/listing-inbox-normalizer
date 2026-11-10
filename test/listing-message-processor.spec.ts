import { ListingMessageProcessor } from '../src/messages/listing-message-processor';
import { ExtractionService } from '../src/extraction/extraction.service';
import { Stage1ExtractionResult } from '../src/extraction/extraction-result.schema';
import { ListingsService } from '../src/listings/listings.service';
import { RawMessage } from '../src/messages/raw-message.schema';

const sampleMessage: RawMessage = {
  id: 'm-unit-01',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('ListingMessageProcessor (Stage 1 Extraction Processor)', () => {
  it('runs a complete mixed-message offer through review without adding a mixed-only reason', async () => {
    const envelope: Stage1ExtractionResult = {
      classification: 'mixed',
      detected_classes: ['listing', 'buyer_request'],
      listings: [
        {
          offer_quote: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
          candidates: [
            { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
            { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
            { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
            { field: 'district', value: 'Al Malqa', quote: 'Al Malqa', scope: 'local' },
            { field: 'bedrooms', value: 5, quote: '5 BR', scope: 'local' },
            { field: 'bathrooms', value: 6, quote: '6 baths', scope: 'local' },
            { field: 'area_sqm', value: 380, kind: 'built_up', quote: '380 sqm built-up', scope: 'local' },
            {
              field: 'price',
              value: { amount: 3200000, currency: 'SAR', period: 'total' },
              role: 'asking_price',
              quote: 'Asking 3.2M SAR',
              scope: 'local',
            },
            { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'local' },
          ],
          findings: [],
        },
      ],
    };

    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          ok: true,
          classification: envelope.classification,
          detected_classes: envelope.detected_classes,
          offers: envelope.listings.map((listing, offer_index) => ({
            offer_index,
            offer_quote: listing.offer_quote,
            acceptedCandidates: listing.candidates,
            rejectedCandidates: [],
            semanticFindings: listing.findings,
            rejectedFindings: [],
            validationFindings: [],
          })),
        },
      }),
    } as unknown as ExtractionService;
    const realListingsService = new ListingsService();
    const process = jest.fn((input) => realListingsService.process(input));
    const listingsService = { process } as unknown as ListingsService;

    const processor = new ListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);

    expect(result).toEqual(envelope);
    expect(process).toHaveBeenCalledTimes(1);
    expect(process.mock.results[0].value.review).toEqual({ needs_review: false, review_reasons: [] });
  });

  it('passes through extraction failures directly', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: false,
        failure: {
          message_id: 'm-unit-01',
          error: { code: 'provider_unavailable', message: 'Extraction is not configured' },
        },
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(extractionService, {} as ListingsService);
    const result = await processor.process(sampleMessage);

    expect(result).toEqual({
      message_id: 'm-unit-01',
      error: { code: 'provider_unavailable', message: 'Extraction is not configured' },
    });
  });

  it('handles non-listing classification envelopes with empty listings', async () => {
    const buyerEnvelope: Stage1ExtractionResult = {
      classification: 'buyer_request',
      detected_classes: ['buyer_request'],
      listings: [],
    };

    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          ok: true,
          classification: buyerEnvelope.classification,
          detected_classes: buyerEnvelope.detected_classes,
          offers: [],
        },
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(extractionService, {} as ListingsService);
    const result = await processor.process({ ...sampleMessage, text: 'Looking for 3 BR villa in Riyadh' });

    expect(result).toEqual(buyerEnvelope);
  });
});
