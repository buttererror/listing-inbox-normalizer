import { resolveListing } from '../src/listings/resolve-listing';
import { normalizeSupportedAssertions } from '../src/listings/normalize-supported-assertions';
import { ListingsService } from '../src/listings/listings.service';
import type { Assertion } from '../src/extraction/verify-verbatim-evidence';
import type { RejectedEvidence } from '../src/extraction/verify-source-integrity';

describe('02.5T — Field resolution and review', () => {
  it('returns a complete supported listing with needs_review: false and empty reasons', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'للبيع' },
      { field: 'property_type', quote: 'فيلا' },
      { field: 'city', quote: 'مدينة: الرياض' },
      { field: 'district', quote: 'حي: الملقا' },
      { field: 'bedrooms', quote: '5 غرف نوم' },
      { field: 'bathrooms', quote: '6 حمامات' },
      { field: 'area_sqm', quote: '380 sqm built-up' },
      { field: 'price', quote: '3.2M SAR' },
      { field: 'contact_phone', quote: 'call 0551234567' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing } = resolveListing({ id: 'l-001', values, findings });

    expect(listing).toEqual({
      id: 'l-001',
      purpose: 'sale',
      property_type: 'villa',
      city: 'الرياض',
      district: 'الملقا',
      bedrooms: 5,
      bathrooms: 6,
      area_sqm: 380,
      price: { amount: 3200000, currency: 'SAR', period: 'total' },
      contact_phone: '+966551234567',
      needs_review: false,
      review_reasons: [],
      duplicate_of: null,
    });
  });

  it('leaves missing and unsupported fields null with readable reasons, ignoring sender phone', () => {
    // Villa has no offered contact quote; sender has phone number but sender is not used
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'city', quote: 'city: Riyadh' },
      { field: 'district', quote: 'district: Al Malqa' },
      { field: 'bedrooms', quote: '5 BR' },
      { field: 'area_sqm', quote: '380 sqm' },
      { field: 'price', quote: '3.2M SAR' },
    ];
    // Bathroom was claimed with quote '5 BR', rejected during extraction
    const rejectedEvidence: RejectedEvidence[] = [
      { assertion: { field: 'bathrooms', quote: '5 BR' }, reason: 'field_contradicted' },
    ];

    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing } = resolveListing({
      id: 'l-002',
      values,
      findings,
      rejectedEvidence,
    });

    expect(listing.contact_phone).toBeNull();
    expect(listing.bathrooms).toBeNull();
    expect(listing.review_reasons).toContain('contact_phone_missing');
    expect(listing.review_reasons).toContain('bathrooms_unsupported');
    expect(listing.needs_review).toBe(true);
  });

  it('leaves bedrooms and bathrooms null for land without missing-field reasons', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'land' },
      { field: 'city', quote: 'city: Riyadh' },
      { field: 'district', quote: 'district: Al Malqa' },
      { field: 'area_sqm', quote: '450 sqm' },
      { field: 'price', quote: '3.2M SAR' },
      { field: 'contact_phone', quote: 'call 0551234567' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing } = resolveListing({ id: 'l-003', values, findings });

    expect(listing.property_type).toBe('land');
    expect(listing.bedrooms).toBeNull();
    expect(listing.bathrooms).toBeNull();
    expect(listing.review_reasons).not.toContain('bedrooms_missing');
    expect(listing.review_reasons).not.toContain('bathrooms_missing');
    expect(listing.review_reasons).toEqual([]);
    expect(listing.needs_review).toBe(false);
  });

  it('leaves price null, retains evidence and sets needs_review: true on conflicting prices', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'price', quote: '3.2M SAR' },
      { field: 'price', quote: '3,200,001 SAR' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing, evidence } = resolveListing({ id: 'l-004', values, findings });

    expect(listing.price).toEqual({
      amount: null,
      currency: 'SAR',
      period: null,
    });
    expect(listing.review_reasons).toContain('price_conflict');
    expect(listing.needs_review).toBe(true);
    expect(evidence.values.filter((v) => v.field === 'price')).toHaveLength(2);
  });

  it('leaves area_sqm null and records conflict for conflicting area assertions', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'area_sqm', quote: 'built-up area 380 sqm' },
      { field: 'area_sqm', quote: 'built-up area 390 m2' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing, selectedAreaKind } = resolveListing({ id: 'l-005', values, findings });

    expect(listing.area_sqm).toBeNull();
    expect(selectedAreaKind).toBeUndefined();
    expect(listing.review_reasons).toContain('area_sqm_conflict');
    expect(listing.needs_review).toBe(true);
  });

  it('selects built-up area over land area for a villa without conflict', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'area_sqm', quote: 'land area 450 sqm' },
      { field: 'area_sqm', quote: 'built-up area 380 sqm' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing, selectedAreaKind } = resolveListing({ id: 'l-006', values, findings });

    expect(listing.area_sqm).toBe(380);
    expect(selectedAreaKind).toBe('built_up');
    expect(listing.review_reasons).not.toContain('area_sqm_conflict');
  });

  it('records price_unsupported when a price finding cannot be normalized', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'price', quote: '250,000 USD' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing } = resolveListing({ id: 'l-007', values, findings });

    expect(listing.price).toEqual({
      amount: null,
      currency: 'SAR',
      period: null,
    });
    expect(listing.review_reasons).toContain('price_unsupported');
    expect(listing.needs_review).toBe(true);
  });

  it('does not treat identical normalized values as a conflict', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'city', quote: 'city: Riyadh' },
      { field: 'city', quote: 'city: Riyadh' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing } = resolveListing({ id: 'l-008', values, findings });

    expect(listing.city).toBe('Riyadh');
    expect(listing.review_reasons).not.toContain('city_conflict');
  });

  it('keeps the verified asking price when a deposit is rejected', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'price', quote: '3.2M SAR' },
    ];
    const rejectedEvidence: RejectedEvidence[] = [
      { assertion: { field: 'price', quote: 'Deposit: 50,000 SAR' }, reason: 'field_contradicted' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing, evidence } = resolveListing({
      id: 'l-009',
      values,
      findings,
      rejectedEvidence,
    });

    expect(listing.price).toEqual({
      amount: 3200000,
      currency: 'SAR',
      period: 'total',
    });
    expect(listing.review_reasons).not.toContain('price_conflict');
    expect(listing.review_reasons).not.toContain('price_uncertain');
    expect(evidence.rejectedEvidence).toEqual(rejectedEvidence);
  });

  it('retains a supported price and flags competing uncertain evidence', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' }, { field: 'property_type', quote: 'villa' },
      { field: 'city', quote: 'city: Riyadh' }, { field: 'district', quote: 'district: Malqa' },
      { field: 'bedrooms', quote: '5 BR' }, { field: 'bathrooms', quote: '6 baths' },
      { field: 'area_sqm', quote: '380 sqm' }, { field: 'price', quote: '3.2M SAR' },
      { field: 'contact_phone', quote: 'call 0551234567' },
    ];
    const rejectedEvidence: RejectedEvidence[] = [
      { assertion: { field: 'price', quote: '900 ألف' }, reason: 'field_uncertain' },
    ];
    const result = resolveListing({ id: 'uncertain', ...normalizeSupportedAssertions(assertions), rejectedEvidence });
    expect(result.listing.price.amount).toBe(3200000);
    expect(result.listing.review_reasons).toEqual(['price_uncertain']);
    expect(result.listing.needs_review).toBe(true);
    expect(result.evidence.rejectedEvidence).toEqual(rejectedEvidence);
  });

  it('flags uncertainty as the only evidence for a field', () => {
    const rejectedEvidence: RejectedEvidence[] = [
      { assertion: { field: 'price', quote: 'maybe 900 ألف' }, reason: 'field_uncertain' },
    ];
    const { listing } = resolveListing({ id: 'uncertain-only', values: [], rejectedEvidence });
    expect(listing.price.amount).toBeNull();
    expect(listing.review_reasons).toContain('price_uncertain');
    expect(listing.review_reasons).not.toContain('price_unsupported');
  });

  it('omits the area kind when unresolved property projections have equal values but different kinds', () => {
    const { values } = normalizeSupportedAssertions([
      { field: 'area_sqm', quote: 'land area 300 sqm' },
      { field: 'area_sqm', quote: 'built-up area 300 sqm' },
    ]);
    const result = resolveListing({ id: 'equal-areas', values });
    expect(result.listing.area_sqm).toBe(300);
    expect(result.selectedAreaKind).toBeUndefined();
    expect(result.listing.review_reasons).toContain('property_type_missing');
  });

  it('keeps supported counts but does not require missing counts when type is unresolved', () => {
    const { values } = normalizeSupportedAssertions([{ field: 'bedrooms', quote: '5 BR' }]);
    const rejectedEvidence: RejectedEvidence[] = [
      { assertion: { field: 'bedrooms', quote: 'maybe 6 BR' }, reason: 'field_uncertain' },
    ];
    const { listing } = resolveListing({ id: 'unknown-type', values, rejectedEvidence });
    expect(listing.bedrooms).toBe(5);
    expect(listing.bathrooms).toBeNull();
    expect(listing.review_reasons).toContain('bedrooms_uncertain');
    expect(listing.review_reasons).not.toContain('bathrooms_missing');
  });

  it('leaves area null with review reason when conflicting property types change area selection', () => {
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'sale' },
      { field: 'property_type', quote: 'villa' },
      { field: 'property_type', quote: 'land' },
      { field: 'area_sqm', quote: 'built-up area 380 sqm' },
      { field: 'area_sqm', quote: 'land area 450 sqm' },
    ];
    const { values, findings } = normalizeSupportedAssertions(assertions);
    const { listing } = resolveListing({ id: 'l-010', values, findings });

    expect(listing.property_type).toBeNull();
    expect(listing.area_sqm).toBeNull();
    expect(listing.review_reasons).toContain('property_type_conflict');
    expect(listing.review_reasons).toContain('area_sqm_conflict');
    expect(listing.needs_review).toBe(true);
  });

  it('processes normalization and resolution through ListingsService', () => {
    const service = new ListingsService();
    const assertions: Assertion[] = [
      { field: 'purpose', quote: 'للبيع' },
      { field: 'property_type', quote: 'أرض' },
      { field: 'city', quote: 'مدينة: جدة' },
      { field: 'district', quote: 'حي: أبحر' },
      { field: 'area_sqm', quote: '900 sqm' },
      { field: 'price', quote: '2.1M SAR' },
      { field: 'contact_phone', quote: 'تواصل: 0555556666' },
    ];
    const { listing } = service.process('listing-jeddah', assertions);

    expect(listing).toMatchObject({
      id: 'listing-jeddah',
      purpose: 'sale',
      property_type: 'land',
      city: 'جدة',
      district: 'أبحر',
      bedrooms: null,
      bathrooms: null,
      area_sqm: 900,
      price: { amount: 2100000, currency: 'SAR', period: 'total' },
      contact_phone: '+966555556666',
      needs_review: false,
      review_reasons: [],
      duplicate_of: null,
    });
  });
});
