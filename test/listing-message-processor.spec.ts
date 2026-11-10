import { ListingMessageProcessor } from '../src/messages/listing-message-processor';
import { ExtractionService } from '../src/extraction/extraction.service';
import { ListingsService } from '../src/listings/listings.service';
import { RawMessage } from '../src/messages/raw-message.schema';
import { MessageSuccess } from '../src/messages/message-result.schema';
import { OfferValidationOutcome } from '../src/extraction/stage2-mechanical-validation';

const sampleMessage: RawMessage = {
  id: 'm-unit-01',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('ListingMessageProcessor — Task 02.6 Public Result Assembly', () => {
  let idCounter: number;
  let generateId: () => string;
  let listingsService: ListingsService;

  beforeEach(() => {
    idCounter = 0;
    generateId = () => `listing-${++idCounter}`;
    listingsService = new ListingsService();
  });

  const createProcessor = (extractResult: any) => {
    const extractionService = {
      extract: jest.fn().mockResolvedValue(extractResult),
    } as unknown as ExtractionService;
    return new ListingMessageProcessor(extractionService, listingsService, generateId);
  };

  describe('1. Classification and offer assembly', () => {
    it('assembles a single sale listing with distinct ID and preserves values', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
        acceptedCandidates: [
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
            quote: 'Asking 3.2M SAR',
            scope: 'local',
          },
          { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'local' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'listing',
          detected_classes: ['listing'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.message_id).toBe('m-unit-01');
      expect(success.classification).toBe('listing');
      expect(success.detected_classes).toEqual(['listing']);
      expect(success.listings).toHaveLength(1);

      const listing = success.listings[0];
      expect(listing).toEqual({
        id: 'listing-1',
        purpose: 'sale',
        property_type: 'villa',
        city: 'Riyadh',
        district: 'Al Malqa',
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

    it('assembles a single rental listing preserving rent purpose and yearly period', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'For rent: Apartment in Jeddah. 45000 SAR yearly.',
        acceptedCandidates: [
          { field: 'purpose', value: 'rent', quote: 'For rent', scope: 'local' },
          { field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' },
          { field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'local' },
          {
            field: 'price',
            value: { amount: 45000, currency: 'SAR', period: 'yearly' },
            role: 'asking_price',
            quote: '45000 SAR yearly',
            scope: 'local',
          },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'listing',
          detected_classes: ['listing'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.listings).toHaveLength(1);
      const listing = success.listings[0];
      expect(listing.purpose).toBe('rent');
      expect(listing.price.period).toBe('yearly');
      expect(listing.price.amount).toBe(45000);
      expect(listing.price.currency).toBe('SAR');
      expect(listing.needs_review).toBe(true);
      expect(listing.review_reasons).toContain('district_missing');
    });

    it('assembles multiple offers with distinct listing IDs and preserves offer order', async () => {
      const offer1: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: '1) Villa in Riyadh',
        acceptedCandidates: [
          { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
          { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };
      const offer2: OfferValidationOutcome = {
        offer_index: 1,
        offer_quote: '2) Apartment in Jeddah',
        acceptedCandidates: [
          { field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' },
          { field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'local' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'listing',
          detected_classes: ['listing'],
          offers: [offer1, offer2],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.listings).toHaveLength(2);
      expect(success.listings[0].id).toBe('listing-1');
      expect(success.listings[0].property_type).toBe('villa');
      expect(success.listings[0].city).toBe('Riyadh');

      expect(success.listings[1].id).toBe('listing-2');
      expect(success.listings[1].property_type).toBe('apartment');
      expect(success.listings[1].city).toBe('Jeddah');
    });

    it('assembles mixed listing + buyer request: retains mixed classification, detected_classes, and assembles only the genuine offer', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'For sale: Townhouse in Khobar',
        acceptedCandidates: [
          { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
          { field: 'property_type', value: 'townhouse', quote: 'Townhouse', scope: 'local' },
          { field: 'city', value: 'Khobar', quote: 'Khobar', scope: 'local' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'mixed',
          detected_classes: ['listing', 'buyer_request'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.classification).toBe('mixed');
      expect(success.detected_classes).toEqual(['listing', 'buyer_request']);
      expect(success.listings).toHaveLength(1);
      expect(success.listings[0].property_type).toBe('townhouse');
    });

    it('preserves source-ordered detected_classes when non-listing intent comes first', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'Offer: Studio in Riyadh',
        acceptedCandidates: [
          { field: 'property_type', value: 'studio', quote: 'Studio', scope: 'local' },
          { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'mixed',
          detected_classes: ['buyer_request', 'listing'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.classification).toBe('mixed');
      expect(success.detected_classes).toEqual(['buyer_request', 'listing']);
      expect(success.listings).toHaveLength(1);
    });

    it('assembles mixed project + listing: project intent retained, only genuine offer assembled', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'Specific unit: Penthouse Apartment in Tower A',
        acceptedCandidates: [
          { field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'mixed',
          detected_classes: ['project', 'listing'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.classification).toBe('mixed');
      expect(success.detected_classes).toEqual(['project', 'listing']);
      expect(success.listings).toHaveLength(1);
    });

    it('returns empty listings for buyer request', async () => {
      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'buyer_request',
          detected_classes: ['buyer_request'],
          offers: [],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.classification).toBe('buyer_request');
      expect(success.detected_classes).toEqual(['buyer_request']);
      expect(success.listings).toEqual([]);
    });

    it('returns empty listings for irrelevant message', async () => {
      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'irrelevant',
          detected_classes: ['irrelevant'],
          offers: [],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.classification).toBe('irrelevant');
      expect(success.detected_classes).toEqual(['irrelevant']);
      expect(success.listings).toEqual([]);
    });

    it('returns empty listings for project-only announcement without independent offers', async () => {
      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'project',
          detected_classes: ['project'],
          offers: [],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.classification).toBe('project');
      expect(success.detected_classes).toEqual(['project']);
      expect(success.listings).toEqual([]);
    });
  });

  describe('2. Resolution and review integration', () => {
    it('apartment with competing asking prices leaves public amount null with price_conflict', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'Apartment: Price 900K or 950K',
        acceptedCandidates: [
          { field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' },
          {
            field: 'price',
            value: { amount: 900000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: '900K',
            scope: 'local',
          },
          {
            field: 'price',
            value: { amount: 950000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: '950K',
            scope: 'local',
          },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'listing',
          detected_classes: ['listing'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      const listing = success.listings[0];
      expect(listing.price.amount).toBeNull();
      expect(listing.price.currency).toBe('SAR');
      expect(listing.needs_review).toBe(true);
      expect(listing.review_reasons).toContain('price_conflict');
    });

    it('invalid rejected candidate cannot influence selected fields and triggers review', async () => {
      const offer: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: 'Villa with 3 BR',
        acceptedCandidates: [
          { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
        ],
        rejectedCandidates: [
          {
            candidate: { field: 'bedrooms', value: 4, quote: '3 BR', scope: 'local' },
            field: 'bedrooms',
            quote: '3 BR',
            reason: 'quote_value_mismatch',
          },
        ],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'listing',
          detected_classes: ['listing'],
          offers: [offer],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      const listing = success.listings[0];
      expect(listing.bedrooms).toBeNull();
      expect(listing.needs_review).toBe(true);
      expect(listing.review_reasons).toContain('bedrooms_unsupported');
    });

    it('two offers maintain offer-specific review findings without leakage', async () => {
      const offer1: OfferValidationOutcome = {
        offer_index: 0,
        offer_quote: '1) Land in Riyadh 500 sqm',
        acceptedCandidates: [
          { field: 'property_type', value: 'land', quote: 'Land', scope: 'local' },
          { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
          { field: 'district', value: 'Al Malqa', quote: 'Al Malqa', scope: 'local' },
          { field: 'area_sqm', value: 500, kind: 'land', quote: '500 sqm', scope: 'local' },
          { field: 'purpose', value: 'sale', quote: 'sale', scope: 'local' },
          {
            field: 'price',
            value: { amount: 1500000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: '1500000',
            scope: 'local',
          },
          { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'shared' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const offer2: OfferValidationOutcome = {
        offer_index: 1,
        offer_quote: '2) Villa in Jeddah, price unclear',
        acceptedCandidates: [
          { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
          { field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'local' },
          { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'shared' },
        ],
        rejectedCandidates: [],
        semanticFindings: [],
        rejectedFindings: [],
        validationFindings: [],
      };

      const processor = createProcessor({
        ok: true,
        result: {
          ok: true,
          classification: 'listing',
          detected_classes: ['listing'],
          offers: [offer1, offer2],
        },
      });

      const outcome = await processor.process(sampleMessage);
      const success = outcome as MessageSuccess;

      expect(success.listings).toHaveLength(2);

      // Offer 1 (land): bedrooms/bathrooms inapplicable, has all required fields -> needs_review: false
      const landListing = success.listings[0];
      expect(landListing.property_type).toBe('land');
      expect(landListing.bedrooms).toBeNull();
      expect(landListing.bathrooms).toBeNull();
      expect(landListing.needs_review).toBe(false);
      expect(landListing.review_reasons).toEqual([]);
      expect(landListing.contact_phone).toBe('+966551234567');

      // Offer 2 (villa): missing price, bedrooms, bathrooms, area, district -> needs_review: true
      const villaListing = success.listings[1];
      expect(villaListing.property_type).toBe('villa');
      expect(villaListing.needs_review).toBe(true);
      expect(villaListing.review_reasons).toContain('price_missing');
      expect(villaListing.review_reasons).toContain('bedrooms_missing');
      // Shared contact preserved in both
      expect(villaListing.contact_phone).toBe('+966551234567');
    });
  });

  describe('3. Failure pass-through', () => {
    it('passes through extraction failures directly without modification', async () => {
      const processor = createProcessor({
        ok: false,
        failure: {
          message_id: 'm-unit-01',
          error: { code: 'invalid_extraction', message: 'Ungrounded listing claimed' },
        },
      });

      const outcome = await processor.process(sampleMessage);
      expect(outcome).toEqual({
        message_id: 'm-unit-01',
        error: { code: 'invalid_extraction', message: 'Ungrounded listing claimed' },
      });
    });

    it('passes through provider unavailable failures directly', async () => {
      const processor = createProcessor({
        ok: false,
        failure: {
          message_id: 'm-unit-01',
          error: { code: 'provider_unavailable', message: 'Provider key missing' },
        },
      });

      const outcome = await processor.process(sampleMessage);
      expect(outcome).toEqual({
        message_id: 'm-unit-01',
        error: { code: 'provider_unavailable', message: 'Provider key missing' },
      });
    });
  });
});
