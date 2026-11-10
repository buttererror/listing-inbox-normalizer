import * as fs from 'fs';
import * as path from 'path';
import { validateStage2 } from '../src/extraction/stage2-mechanical-validation';
import { ListingsService } from '../src/listings/listings.service';
import { resolveOffer } from '../src/listings/resolve-offer';
import { reviewResolvedOffer } from '../src/listings/runtime-reviewer';
import { RawMessage, rawMessageSchema } from '../src/messages/raw-message.schema';
import { Stage1ExtractionResult } from '../src/extraction/extraction-result.schema';

describe('02.5 Offline Integration — Stage 2 to Field Resolver & Runtime Reviewer', () => {
  const fixturePath = path.join(__dirname, 'fixtures/resolver-reviewer.jsonl');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf8').trim();
  const rawMessage: RawMessage = rawMessageSchema.parse(JSON.parse(fixtureContent));

  const baseExtraction: Stage1ExtractionResult = {
    classification: 'listing',
    detected_classes: ['listing'],
    listings: [
      {
        offer_quote:
          '١) للبيع فيلا في الرياض، حي الملقا، ٤ غرف نوم، ٣ دورات مياه، المساحة ٣٠٠ م²، السعر ٢ مليون ريال.',
        candidates: [
          { field: 'purpose', value: 'sale', quote: 'للبيع', scope: 'local' },
          { field: 'property_type', value: 'villa', quote: 'فيلا', scope: 'local' },
          { field: 'city', value: 'الرياض', quote: 'الرياض', scope: 'local' },
          { field: 'district', value: 'الملقا', quote: 'حي الملقا', scope: 'local' },
          { field: 'bedrooms', value: 4, quote: '٤ غرف نوم', scope: 'local' },
          { field: 'bathrooms', value: 3, quote: '٣ دورات مياه', scope: 'local' },
          { field: 'area_sqm', value: 300, kind: 'unspecified', quote: 'المساحة ٣٠٠ م²', scope: 'local' },
          {
            field: 'price',
            value: { amount: 2000000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: 'السعر ٢ مليون ريال',
            scope: 'local',
          },
          { field: 'contact_phone', value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'shared' },
        ],
        findings: [],
      },
      {
        offer_quote:
          '٢) للبيع شقة في جدة، حي الروضة، ٣ غرف نوم، ٢ حمام، المساحة ١٦٥ م²، السعر ٩٥٠ ألف ريال، لكن ذُكر أيضًا أن السعر مليون ريال.',
        candidates: [
          { field: 'purpose', value: 'sale', quote: 'للبيع', scope: 'local' },
          { field: 'property_type', value: 'apartment', quote: 'شقة', scope: 'local' },
          { field: 'city', value: 'جدة', quote: 'جدة', scope: 'local' },
          { field: 'district', value: 'الروضة', quote: 'حي الروضة', scope: 'local' },
          { field: 'bedrooms', value: 3, quote: '٣ غرف نوم', scope: 'local' },
          { field: 'bathrooms', value: 2, quote: '٢ حمام', scope: 'local' },
          { field: 'area_sqm', value: 165, kind: 'unspecified', quote: 'المساحة ١٦٥ م²', scope: 'local' },
          {
            field: 'price',
            value: { amount: 950000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: 'السعر ٩٥٠ ألف ريال',
            scope: 'local',
          },
          {
            field: 'price',
            value: { amount: 1000000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: 'مليون ريال',
            scope: 'local',
          },
          { field: 'contact_phone', value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'shared' },
        ],
        findings: [
          {
            category: 'contradiction',
            field: 'price',
            quote: 'لكن ذُكر أيضًا أن السعر مليون ريال',
            description: 'Two conflicting prices mentioned for the apartment',
          },
        ],
      },
    ],
  };

  it('passes mocked extraction through Stage 2, Field Resolver, and Runtime Reviewer with D-020 compliance', () => {
    // 1. Stage 2 Mechanical Validation
    const stage2Outcome = validateStage2(rawMessage.text, baseExtraction);
    expect(stage2Outcome.ok).toBe(true);
    if (!stage2Outcome.ok) return;

    expect(stage2Outcome.offers).toHaveLength(2);

    const listingsService = new ListingsService();
    const villaOutcome = stage2Outcome.offers[0];
    const apartmentOutcome = stage2Outcome.offers[1];

    // 2. Field Resolver & Runtime Reviewer
    const villaReviewed = listingsService.process(villaOutcome);
    const apartmentReviewed = listingsService.process(apartmentOutcome);

    // Assert Villa: sale, 4 bedrooms, 3 bathrooms, 300 m², 2,000,000 SAR, correct shared phone
    expect(villaReviewed.resolved.fields).toEqual({
      purpose: 'sale',
      property_type: 'villa',
      city: 'الرياض',
      district: 'الملقا',
      bedrooms: 4,
      bathrooms: 3,
      area_sqm: 300,
      price: {
        amount: 2000000,
        currency: 'SAR',
        period: 'total',
      },
      contact_phone: '+966551234567',
    });
    expect(villaReviewed.resolved.selectedAreaKind).toBe('unspecified');

    // Assert Villa review: under D-020, all applicable fields are cleanly supported, no conflicts or missing fields
    expect(villaReviewed.resolved.findings).toEqual([]);
    expect(villaReviewed.review).toEqual({
      needs_review: false,
      review_reasons: [],
    });

    // Assert Apartment: sale, 3 bedrooms, 2 bathrooms, 165 m², unresolved asking price (amount: null), correct shared phone
    expect(apartmentReviewed.resolved.fields).toEqual({
      purpose: 'sale',
      property_type: 'apartment',
      city: 'جدة',
      district: 'الروضة',
      bedrooms: 3,
      bathrooms: 2,
      area_sqm: 165,
      price: {
        amount: null,
        currency: 'SAR',
        period: null,
      },
      contact_phone: '+966551234567',
    });
    expect(apartmentReviewed.resolved.selectedAreaKind).toBe('unspecified');

    // Assert Apartment requires review for conflicting asking prices of 950,000 and 1,000,000 SAR
    expect(apartmentReviewed.resolved.findings).toContainEqual({
      field: 'price',
      issue: 'conflict',
    });
    expect(apartmentReviewed.review).toEqual({
      needs_review: true,
      review_reasons: ['price_conflict'],
    });

    // Assert Villa does not inherit the apartment's conflict
    expect(villaReviewed.resolved.fields.price.amount).toBe(2000000);
    expect(villaReviewed.resolved.findings).not.toContainEqual({
      field: 'price',
      issue: 'conflict',
    });
    expect(villaReviewed.review.review_reasons).not.toContain('price_conflict');

    // Assert Provenance preservation:
    // Villa: every field has accepted and selected candidates
    expect(villaReviewed.resolved.provenance.purpose.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.property_type.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.city.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.district.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.bedrooms.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.bathrooms.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.area_sqm.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.price.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.price.selectedCandidates[0].quote).toBe('السعر ٢ مليون ريال');
    expect(villaReviewed.resolved.provenance.contact_phone.selectedCandidates).toHaveLength(1);
    expect(villaReviewed.resolved.provenance.contact_phone.selectedCandidates[0].quote).toBe('٠٥٥١٢٣٤٥٦٧');

    // Apartment: both conflicting price candidates are preserved in acceptedCandidates, but NONE in selectedCandidates
    expect(apartmentReviewed.resolved.provenance.price.acceptedCandidates).toHaveLength(2);
    expect(apartmentReviewed.resolved.provenance.price.acceptedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quote: 'السعر ٩٥٠ ألف ريال', value: { amount: 950000, currency: 'SAR', period: 'total' } }),
        expect.objectContaining({ quote: 'مليون ريال', value: { amount: 1000000, currency: 'SAR', period: 'total' } }),
      ]),
    );
    expect(apartmentReviewed.resolved.provenance.price.selectedCandidates).toEqual([]);
    expect(apartmentReviewed.resolved.provenance.price.semanticFindings).toHaveLength(1);
    expect(apartmentReviewed.resolved.provenance.price.semanticFindings[0].category).toBe('contradiction');
  });

  it('verifies that no rejected candidates contribute resolved values or compromise surviving fields', () => {
    // Clone extraction and add invalid/rejected candidates to villa and apartment
    const extractionWithRejections: Stage1ExtractionResult = {
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [
        {
          ...baseExtraction.listings[0],
          candidates: [
            ...baseExtraction.listings[0].candidates,
            // Fabricated quote candidate
            { field: 'price', value: { amount: 5000000, currency: 'SAR', period: 'total' }, role: 'asking_price', quote: 'سعر غير موجود', scope: 'local' },
            // Wrong-offer quote candidate (quotes apartment text inside villa offer)
            { field: 'district', value: 'الروضة', quote: 'حي الروضة', scope: 'local' },
          ],
        },
        {
          ...baseExtraction.listings[1],
          candidates: [
            ...baseExtraction.listings[1].candidates,
            // Negative bedroom candidate (invalid numeric constraint)
            { field: 'bedrooms', value: -1, quote: '٣ غرف نوم', scope: 'local' },
            // Clipped token quote
            { field: 'purpose', value: 'sale', quote: 'للبي', scope: 'local' },
          ],
        },
      ],
    };

    const stage2Outcome = validateStage2(rawMessage.text, extractionWithRejections);
    expect(stage2Outcome.ok).toBe(true);
    if (!stage2Outcome.ok) return;

    const villaOutcome = stage2Outcome.offers[0];
    const apartmentOutcome = stage2Outcome.offers[1];

    // Verify Stage 2 rejected the invalid candidates
    expect(villaOutcome.rejectedCandidates.length).toBeGreaterThanOrEqual(2);
    expect(villaOutcome.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quote: 'سعر غير موجود', reason: 'quote_not_in_source' }),
        expect.objectContaining({ quote: 'حي الروضة', reason: 'wrong_offer' }),
      ]),
    );

    expect(apartmentOutcome.rejectedCandidates.length).toBeGreaterThanOrEqual(2);
    expect(apartmentOutcome.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'bedrooms', reason: 'invalid_numeric_constraint' }),
        expect.objectContaining({ field: 'purpose', reason: 'clipped_token' }),
      ]),
    );

    // Pass through Field Resolver
    const resolvedVilla = resolveOffer(villaOutcome);
    const resolvedApartment = resolveOffer(apartmentOutcome);

    // Villa: the rejected fabricated price does NOT overwrite or conflict with the valid 2,000,000 SAR asking price
    expect(resolvedVilla.fields.price.amount).toBe(2000000);
    expect(resolvedVilla.fields.district).toBe('الملقا');

    // Villa provenance: rejected candidates are tracked in rejectedCandidates and absent from selectedCandidates
    expect(resolvedVilla.provenance.price.rejectedCandidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ quote: 'سعر غير موجود' })]),
    );
    expect(resolvedVilla.provenance.price.selectedCandidates).toHaveLength(1);
    expect(resolvedVilla.provenance.price.selectedCandidates[0].quote).toBe('السعر ٢ مليون ريال');

    expect(resolvedVilla.provenance.district.rejectedCandidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ quote: 'حي الروضة' })]),
    );
    expect(resolvedVilla.provenance.district.selectedCandidates).toHaveLength(1);
    expect(resolvedVilla.provenance.district.selectedCandidates[0].value).toBe('الملقا');

    // Apartment: the valid 3 bedrooms candidate is selected; the invalid -1 bedroom is rejected and contributes nothing
    expect(resolvedApartment.fields.bedrooms).toBe(3);
    expect(resolvedApartment.provenance.bedrooms.rejectedCandidates).toHaveLength(1);
    expect(resolvedApartment.provenance.bedrooms.selectedCandidates).toHaveLength(1);
    expect(resolvedApartment.provenance.bedrooms.selectedCandidates[0].value).toBe(3);

    // Apartment: valid purpose ('للبيع') is selected; the clipped quote ('للبي') is rejected and contributes nothing
    expect(resolvedApartment.fields.purpose).toBe('sale');
    expect(resolvedApartment.provenance.purpose.rejectedCandidates).toHaveLength(1);
    expect(resolvedApartment.provenance.purpose.selectedCandidates).toHaveLength(1);
    expect(resolvedApartment.provenance.purpose.selectedCandidates[0].quote).toBe('للبيع');

    // Verify Reviewer decisions
    const villaReview = reviewResolvedOffer(resolvedVilla);
    const apartmentReview = reviewResolvedOffer(resolvedApartment);

    // Under D-020: "A harmless rejected assertion does not invalidate a supported value."
    // Because Villa has all applicable fields supported, harmless rejections do not trigger review
    expect(villaReview.needs_review).toBe(false);
    expect(villaReview.review_reasons).toEqual([]);

    // Apartment still requires review for the price conflict
    expect(apartmentReview.needs_review).toBe(true);
    expect(apartmentReview.review_reasons).toEqual(['price_conflict']);
  });

  it('Stage 2 → 02.5 integration: rejected villa price (900K) + valid (2M) resolves villa to 2M, while apartment competing prices (950K & 1M) remain unresolved', () => {
    // Inject Stage 2 result directly:
    // Villa: rejected price 900K (for example, wrong_offer), valid price 2M
    // Apartment: two valid competing asking prices (950K, 1M), contradiction finding
    const villaOutcome = {
      offer_index: 0,
      offer_quote: '١) للبيع فيلا في الرياض، حي الملقا، ٤ غرف نوم، ٣ دورات مياه، المساحة ٣٠٠ م²، السعر ٢ مليون ريال.',
      acceptedCandidates: [
        { field: 'purpose' as const, value: 'sale' as const, quote: 'للبيع', scope: 'local' as const },
        { field: 'property_type' as const, value: 'villa' as const, quote: 'فيلا', scope: 'local' as const },
        { field: 'city' as const, value: 'الرياض', quote: 'الرياض', scope: 'local' as const },
        { field: 'district' as const, value: 'الملقا', quote: 'حي الملقا', scope: 'local' as const },
        { field: 'bedrooms' as const, value: 4, quote: '٤ غرف نوم', scope: 'local' as const },
        { field: 'bathrooms' as const, value: 3, quote: '٣ دورات مياه', scope: 'local' as const },
        { field: 'area_sqm' as const, value: 300, kind: 'unspecified' as const, quote: 'المساحة ٣٠٠ م²', scope: 'local' as const },
        {
          field: 'price' as const,
          value: { amount: 2000000, currency: 'SAR' as const, period: 'total' as const },
          role: 'asking_price' as const,
          quote: 'السعر ٢ مليون ريال',
          scope: 'local' as const,
        },
        { field: 'contact_phone' as const, value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'shared' as const },
      ],
      rejectedCandidates: [
        {
          candidate: {
            field: 'price',
            value: { amount: 900000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: 'السعر ٩٥٠ ألف ريال',
            scope: 'local',
          },
          field: 'price',
          quote: 'السعر ٩٥٠ ألف ريال',
          scope: 'local' as const,
          reason: 'wrong_offer' as const,
        },
      ],
      semanticFindings: [],
      rejectedFindings: [],
      validationFindings: [],
    };

    const apartmentOutcome = {
      offer_index: 1,
      offer_quote: '٢) للبيع شقة في جدة، حي الروضة، ٣ غرف نوم، ٢ حمام، المساحة ١٦٥ م²، السعر ٩٥٠ ألف ريال، لكن ذُكر أيضًا أن السعر مليون ريال.',
      acceptedCandidates: [
        { field: 'purpose' as const, value: 'sale' as const, quote: 'للبيع', scope: 'local' as const },
        { field: 'property_type' as const, value: 'apartment' as const, quote: 'شقة', scope: 'local' as const },
        { field: 'city' as const, value: 'جدة', quote: 'جدة', scope: 'local' as const },
        { field: 'district' as const, value: 'الروضة', quote: 'حي الروضة', scope: 'local' as const },
        { field: 'bedrooms' as const, value: 3, quote: '٣ غرف نوم', scope: 'local' as const },
        { field: 'bathrooms' as const, value: 2, quote: '٢ حمام', scope: 'local' as const },
        { field: 'area_sqm' as const, value: 165, kind: 'unspecified' as const, quote: 'المساحة ١٦٥ م²', scope: 'local' as const },
        {
          field: 'price' as const,
          value: { amount: 950000, currency: 'SAR' as const, period: 'total' as const },
          role: 'asking_price' as const,
          quote: 'السعر ٩٥٠ ألف ريال',
          scope: 'local' as const,
        },
        {
          field: 'price' as const,
          value: { amount: 1000000, currency: 'SAR' as const, period: 'total' as const },
          role: 'asking_price' as const,
          quote: 'مليون ريال',
          scope: 'local' as const,
        },
        { field: 'contact_phone' as const, value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'shared' as const },
      ],
      rejectedCandidates: [],
      semanticFindings: [
        {
          category: 'contradiction' as const,
          field: 'price' as const,
          quote: 'لكن ذُكر أيضًا أن السعر مليون ريال',
          description: 'Two conflicting prices mentioned for the apartment',
        },
      ],
      rejectedFindings: [],
      validationFindings: [],
    };

    const listingsService = new ListingsService();
    const villa = listingsService.process(villaOutcome);
    const apartment = listingsService.process(apartmentOutcome);

    // Villa resolves to 2,000,000 SAR; rejected 900,000 cannot affect it
    expect(villa.resolved.fields.price.amount).toBe(2000000);
    expect(villa.review.needs_review).toBe(false);
    expect(villa.review.review_reasons).toEqual([]);

    // Apartment price stays unresolved (amount: null); triggers price_conflict review
    expect(apartment.resolved.fields.price.amount).toBeNull();
    expect(apartment.review.needs_review).toBe(true);
    expect(apartment.review.review_reasons).toEqual(['price_conflict']);
  });
});
