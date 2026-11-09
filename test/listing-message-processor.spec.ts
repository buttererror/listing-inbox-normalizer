import { ListingMessageProcessor } from '../src/messages/listing-message-processor';
import { ExtractionService } from '../src/extraction/extraction.service';
import { ListingsService } from '../src/listings/listings.service';
import { RawMessage } from '../src/messages/raw-message.schema';

const sampleMessage: RawMessage = {
  id: 'm-unit-01',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('ListingMessageProcessor', () => {
  const listingsService = new ListingsService();

  it('resolves extracted assertions into a message success record with duplicate_of: null', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'listing',
          candidates: [
            {
              assertions: [
                { field: 'purpose', quote: 'sale' },
                { field: 'property_type', quote: 'Villa' },
                { field: 'price', quote: 'Asking 3.2M SAR' },
              ],
            },
          ],
        },
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(
      extractionService,
      listingsService,
      () => 'fixed-listing-id',
    );

    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      classification: 'listing',
      listings: [
        expect.objectContaining({
          id: 'fixed-listing-id',
          purpose: 'sale',
          property_type: 'villa',
          price: { amount: 3200000, currency: 'SAR', period: 'total' },
          duplicate_of: null,
          needs_review: true,
        }),
      ],
    });
  });

  it('passes through extraction failures directly', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: false,
        failure: {
          message_id: sampleMessage.id,
          error: { code: 'invalid_extraction', message: 'Failed' },
        },
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      error: { code: 'invalid_extraction', message: 'Failed' },
    });
  });

  it('returns empty listings for non-listing classification', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'buyer_request',
          candidates: [],
        },
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new ListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      classification: 'buyer_request',
      listings: [],
    });
  });
});
