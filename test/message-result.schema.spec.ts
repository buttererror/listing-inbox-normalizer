import { messageSuccessSchema, processingFailureSchema } from '../src/messages/message-result.schema';

const listing = {
  id: 'listing-1', purpose: 'sale', property_type: 'villa', city: 'Riyadh',
  district: null, bedrooms: null, bathrooms: null, area_sqm: null,
  price: { amount: 3200000, currency: 'SAR', period: 'total' },
  contact_phone: null, needs_review: true, review_reasons: ['district_missing'], duplicate_of: null,
};
const success = {
  message_id: 'm-001',
  classification: 'listing',
  detected_classes: ['listing'],
  listings: [listing],
};

describe('public result schemas', () => {
  it('accepts a listing result with nullable fields and preserves its values', () => {
    expect(messageSuccessSchema.parse(success)).toEqual(success);
    expect(messageSuccessSchema.safeParse({ ...success, listings: [{ ...listing, price: { amount: null, currency: 'SAR', period: null } }] }).success).toBe(true);
  });

  it('supports mixed classification and preserves source-ordered detected_classes', () => {
    const mixed = {
      message_id: 'm-mixed-01',
      classification: 'mixed',
      detected_classes: ['listing', 'buyer_request'],
      listings: [listing],
    };
    expect(messageSuccessSchema.parse(mixed)).toEqual(mixed);
  });

  it('rejects missing required fields and invalid enums', () => {
    const { period: _period, ...price } = listing.price;
    const { duplicate_of: _duplicate, ...withoutDuplicate } = listing;
    expect(messageSuccessSchema.safeParse({ ...success, listings: [{ ...listing, price }] }).success).toBe(false);
    expect(messageSuccessSchema.safeParse({ ...success, listings: [withoutDuplicate] }).success).toBe(false);
    expect(messageSuccessSchema.safeParse({ ...success, classification: 'unknown' }).success).toBe(false);
    expect(messageSuccessSchema.safeParse({ ...success, listings: [{ ...listing, purpose: 'lease' }] }).success).toBe(false);
    expect(messageSuccessSchema.safeParse({ ...success, detected_classes: ['invalid_class'] }).success).toBe(false);
  });

  it.each(['buyer_request', 'irrelevant'])('requires empty listings for %s', (classification) => {
    expect(messageSuccessSchema.safeParse({ ...success, classification, detected_classes: [classification], listings: [] }).success).toBe(true);
    expect(messageSuccessSchema.safeParse({ ...success, classification, detected_classes: [classification] }).success).toBe(false);
  });

  it('accepts a failure with an unavailable ID and rejects unknown error codes', () => {
    const failure = { message_id: null, error: { code: 'invalid_input', message: 'Invalid JSONL record' } };
    expect(processingFailureSchema.parse(failure)).toEqual(failure);
    expect(processingFailureSchema.safeParse({ ...failure, error: { ...failure.error, code: 'unknown_error' } }).success).toBe(false);
  });
});
