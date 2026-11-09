import { LegacyListingMessageProcessor } from '../src/messages/legacy-listing-message-processor';
import { ExtractionService } from '../src/extraction/extraction.service';
import { ListingsService } from '../src/listings/listings.service';
import { RawMessage } from '../src/messages/raw-message.schema';

const sampleMessage: RawMessage = {
  id: 'm-unit-01',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('LegacyListingMessageProcessor', () => {
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

    const processor = new LegacyListingMessageProcessor(
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

  it('resolves a Stage 1 typed offer into a message success record', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'listing',
          detected_classes: ['listing'],
          listings: [
            {
              offer_quote: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
              candidates: [
                { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
                { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
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
        },
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new LegacyListingMessageProcessor(
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

    const processor = new LegacyListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      error: { code: 'invalid_extraction', message: 'Failed' },
    });
  });

  it('returns empty listings for non-listing classification: buyer_request', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'buyer_request',
          detected_classes: ['buyer_request'],
          listings: [],
        },
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new LegacyListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      classification: 'buyer_request',
      listings: [],
    });
  });

  it('returns empty listings for project announcement without offers', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'project',
          detected_classes: ['project'],
          listings: [],
        },
        rejectedEvidence: [],
      }),
    } as unknown as ExtractionService;

    const processor = new LegacyListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      classification: 'project',
      listings: [],
    });
  });

  it('returns internal_error for mixed classification that interim processor cannot assemble', async () => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'mixed',
          detected_classes: ['listing', 'buyer_request'],
          listings: [
            {
              offer_quote: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
              candidates: [],
              findings: [],
            },
          ],
        },
      }),
    } as unknown as ExtractionService;

    const processor = new LegacyListingMessageProcessor(extractionService, listingsService);
    const result = await processor.process(sampleMessage);
    expect(result).toEqual({
      message_id: 'm-unit-01',
      error: {
        code: 'internal_error',
        message: expect.stringContaining('Interim processor only supports single sale listing assembly'),
      },
    });
  });

  it('routes Stage 1 offers through the bridge regardless of candidate order or missing scope and rejects ungrounded quotes', async () => {
    const rawMsg: RawMessage = {
      id: 'm-p1-01',
      sender: '+966551234567',
      received_at: '2026-11-01T09:12:00+03:00',
      text: 'For sale: Villa',
    };

    const extractionService = {
      extract: jest.fn().mockResolvedValue({
        ok: true,
        result: {
          classification: 'listing',
          detected_classes: ['listing'],
          listings: [
            {
              offer_quote: 'For sale: Villa',
              candidates: [
                { field: 'property_type', quote: 'Villa' }, // Candidate 0 has no scope!
                {
                  field: 'price',
                  value: { amount: 99000000, currency: 'SAR', period: 'total' },
                  role: 'asking_price',
                  quote: '99,000,000 SAR',
                  scope: 'local',
                }, // Candidate 1 is a fabricated price quote
              ],
              findings: [],
            },
          ],
        },
      }),
    } as unknown as ExtractionService;

    const processor = new LegacyListingMessageProcessor(
      extractionService,
      listingsService,
      () => 'fixed-listing-id',
    );

    const result = await processor.process(rawMsg);
    expect(result).toMatchObject({
      message_id: 'm-p1-01',
      classification: 'listing',
      listings: [
        expect.objectContaining({
          id: 'fixed-listing-id',
          price: { amount: null, currency: 'SAR', period: null },
          property_type: null,
          needs_review: true,
        }),
      ],
    });
    // Ensure the 99M SAR was NOT published
    const listing = (result as any).listings[0];
    expect(listing.price.amount).toBeNull();
    expect(listing.review_reasons).toContain('price_unsupported');
  });
});
