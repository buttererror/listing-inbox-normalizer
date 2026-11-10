import type { TypedFieldCandidate } from '../src/extraction/extraction-result.schema';
import type { OfferValidationOutcome } from '../src/extraction/stage2-mechanical-validation';
import { resolveOffer } from '../src/listings/resolve-offer';
import { reviewResolvedOffer } from '../src/listings/runtime-reviewer';

function outcome(candidates: TypedFieldCandidate[] = []): OfferValidationOutcome {
  return {
    offer_index: 0,
    offer_quote: 'Offer evidence',
    acceptedCandidates: candidates,
    rejectedCandidates: [],
    semanticFindings: [],
    rejectedFindings: [],
    validationFindings: [],
  };
}

function completeValidCandidates(): TypedFieldCandidate[] {
  return [
    { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
    { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
    { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
    { field: 'district', value: 'Al Malqa', quote: 'Al Malqa', scope: 'local' },
    { field: 'bedrooms', value: 5, quote: '5 BR', scope: 'local' },
    { field: 'bathrooms', value: 6, quote: '6 baths', scope: 'local' },
    { field: 'area_sqm', value: 380, kind: 'built_up', quote: '380 sqm', scope: 'local' },
    {
      field: 'price',
      value: { amount: 3200000, currency: 'SAR', period: 'total' },
      role: 'asking_price',
      quote: '3.2M SAR',
      scope: 'local',
    },
    { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'local' },
  ];
}

describe('02.5T — Stage 5 runtime reviewer (V01–V11)', () => {
  it('V01: Complete, reliable listing — needs_review: false, review_reasons: []', () => {
    const resolved = resolveOffer(outcome(completeValidCandidates()));
    const review = reviewResolvedOffer(resolved);

    expect(review).toEqual({
      needs_review: false,
      review_reasons: [],
    });
  });

  it('V02: Competing bedrooms — triggers review with bedrooms_conflict', () => {
    const candidates = completeValidCandidates().filter((c) => c.field !== 'bedrooms');
    candidates.push(
      { field: 'bedrooms', value: 3, quote: '3 BR', scope: 'local' },
      { field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' },
    );

    const resolved = resolveOffer(outcome(candidates));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(true);
    expect(review.review_reasons).toContain('bedrooms_conflict');
  });

  it('V03: Missing applicable district — triggers review with district_missing', () => {
    const candidates = completeValidCandidates().filter((c) => c.field !== 'district');
    const resolved = resolveOffer(outcome(candidates));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(true);
    expect(review.review_reasons).toContain('district_missing');
  });

  it('V04: Land without bedrooms — no review for missing bedrooms (inapplicable)', () => {
    const landCandidates: TypedFieldCandidate[] = [
      { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
      { field: 'property_type', value: 'land', quote: 'Land', scope: 'local' },
      { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
      { field: 'district', value: 'Al Malqa', quote: 'Al Malqa', scope: 'local' },
      { field: 'area_sqm', value: 450, kind: 'land', quote: '450 sqm', scope: 'local' },
      {
        field: 'price',
        value: { amount: 3200000, currency: 'SAR', period: 'total' },
        role: 'asking_price',
        quote: '3.2M SAR',
        scope: 'local',
      },
      { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'local' },
    ];

    const resolved = resolveOffer(outcome(landCandidates));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(false);
    expect(review.review_reasons).not.toContain('bedrooms_missing');
    expect(review.review_reasons).not.toContain('bathrooms_missing');
  });

  it('V05: Missing applicable asking price — triggers review with price_missing', () => {
    const candidates = completeValidCandidates().filter((c) => c.field !== 'price');
    const resolved = resolveOffer(outcome(candidates));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(true);
    expect(review.review_reasons).toContain('price_missing');
  });

  it('V06: Unresolved currency — triggers review with price_currency_unknown', () => {
    const candidates = completeValidCandidates().filter((c) => c.field !== 'price');
    candidates.push({
      field: 'price',
      value: { amount: 85000, currency: null, period: 'yearly' },
      role: 'asking_price',
      quote: '85,000/yr',
      scope: 'local',
    });

    const resolved = resolveOffer(outcome(candidates));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(true);
    expect(review.review_reasons).toContain('price_currency_unknown');
  });

  it('V07: Grounded material uncertainty — triggers review with field uncertainty reason', () => {
    const resolved = resolveOffer({
      ...outcome(completeValidCandidates()),
      semanticFindings: [{
        category: 'uncertainty',
        field: 'city',
        quote: 'Riyadh',
        description: 'City is uncertain in context',
      }],
    });
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(true);
    expect(review.review_reasons).toContain('city_uncertain');
  });

  it('V08: Harmless rejected candidate with trusted replacement — no review solely for rejection', () => {
    const resolved = resolveOffer({
      ...outcome(completeValidCandidates()),
      rejectedCandidates: [{
        candidate: {
          field: 'price',
          value: { amount: 50000, currency: 'SAR', period: 'total' },
          role: 'deposit',
          quote: 'Deposit 50K SAR',
          scope: 'local',
        },
        field: 'price',
        quote: 'Deposit 50K SAR',
        scope: 'local',
        reason: 'wrong_offer',
      }],
    });
    const review = reviewResolvedOffer(resolved);

    // Because a trusted asking price (3.2M SAR) is accepted, harmless rejection does not trigger review
    expect(review.needs_review).toBe(false);
    expect(review.review_reasons).toEqual([]);
  });

  it('V09: Multiple identical values — no review solely for repetition', () => {
    const city = { field: 'city' as const, value: 'Riyadh', quote: 'Riyadh', scope: 'local' as const };
    const candidates = [...completeValidCandidates(), city, city];

    const resolved = resolveOffer(outcome(candidates));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(false);
    expect(review.review_reasons).toEqual([]);
  });

  it('V10: Mixed classification containing a complete listing — no review solely for mixed classification', () => {
    // Under D-020: "Mixed classification alone does not flag a complete, reliable listing."
    const resolved = resolveOffer(outcome(completeValidCandidates()));
    const review = reviewResolvedOffer(resolved);

    expect(review.needs_review).toBe(false);
    expect(review.review_reasons).toEqual([]);
  });

  it('V11: Multiple issues — produces stable, nonduplicated review reasons', () => {
    const resolved = resolveOffer({
      ...outcome([
        { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
        { field: 'bedrooms', value: 3, quote: '3 BR', scope: 'local' },
        { field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' },
        { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
      ]),
      semanticFindings: [{
        category: 'uncertainty',
        field: 'city',
        quote: 'Riyadh',
        description: 'Ambiguous association',
      }],
      rejectedCandidates: [{
        candidate: { field: 'bathrooms', value: 5, quote: '5 baths', scope: 'local' },
        field: 'bathrooms',
        quote: '5 baths',
        scope: 'local',
        reason: 'wrong_offer',
      }],
    });

    const review = reviewResolvedOffer(resolved);
    expect(review.needs_review).toBe(true);

    // Verify nonduplicated
    const uniqueReasons = [...new Set(review.review_reasons)];
    expect(review.review_reasons).toEqual(uniqueReasons);

    // Verify exact expected reasons
    expect(review.review_reasons).toEqual(
      expect.arrayContaining([
        'purpose_missing',
        'bedrooms_conflict',
        'city_uncertain',
        'bathrooms_unsupported',
        'district_missing',
        'area_sqm_missing',
        'price_missing',
        'contact_phone_missing',
      ]),
    );
  });
});
