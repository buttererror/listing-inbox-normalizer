import { ListingMessageProcessor } from '../src/messages/listing-message-processor';
import { ExtractionService } from '../src/extraction/extraction.service';
import { Stage1ExtractionResult } from '../src/extraction/extraction-result.schema';
import { RawMessage } from '../src/messages/raw-message.schema';

const sampleMessage: RawMessage = {
  id: 'm-unit-01',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('ListingMessageProcessor (Stage 1 Extraction Processor)', () => {
  it('returns the Stage 1 extraction envelope when extraction succeeds', async () => {
    const envelope: Stage1ExtractionResult = {
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [
        {
          offer_quote: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
          candidates: [
            { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
            { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
            { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
            {
              field: 'price',
              value: { amount: 3200000, currency: 'SAR', period: 'total' },
              role: 'asking_price',
              quote: 'Asking 3.2M SAR',
              scope: 'local',
            },
          ],
          findings: [],
        },
      ],
    };

    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: envelope,
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(extractionService);
    const result = await processor.process(sampleMessage);

    expect(result).toEqual(envelope);
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

    const processor = new ListingMessageProcessor(extractionService);
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
        result: buyerEnvelope,
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(extractionService);
    const result = await processor.process({ ...sampleMessage, text: 'Looking for 3 BR villa in Riyadh' });

    expect(result).toEqual(buyerEnvelope);
  });
});
