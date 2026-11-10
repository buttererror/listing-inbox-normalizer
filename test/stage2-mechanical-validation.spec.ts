import {
  OfferValidationOutcome,
  validateCandidateSchema,
  validateSemanticFindingSchema,
  validateStage2,
} from '../src/extraction/stage2-mechanical-validation';
import { ExtractionService } from '../src/extraction/extraction.service';
import { RawMessage } from '../src/messages/raw-message.schema';

describe('02.2 / 02.3 — Stage 2: Extraction Structure & Source Evidence Validation', () => {
  const multiOfferText = [
    '1) Villa in Riyadh, 3 bedrooms, 2M SAR',
    '2) Apartment in Jeddah, 2 bedrooms, 900K SAR',
    'Call 0551234567',
  ].join('\n');

  const multiOfferRawMessage: RawMessage = {
    id: 'm-task22-01',
    sender: 'broker',
    received_at: '2026-11-01T10:00:00+03:00',
    text: multiOfferText,
  };

  describe('1. Validate extraction structure & schemas independently', () => {
    it('validates candidate schema independently with unknown input', () => {
      const valid = { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' };
      const checkValid = validateCandidateSchema(valid);
      expect(checkValid.success).toBe(true);
      expect(checkValid.candidate).toEqual(valid);

      const invalidEnum = { field: 'property_type', value: 'palace', quote: 'Villa', scope: 'local' };
      const checkInvalidEnum = validateCandidateSchema(invalidEnum);
      expect(checkInvalidEnum.success).toBe(false);
      expect(checkInvalidEnum.error).toBeDefined();

      const invalidType = { field: 'bedrooms', value: -2, quote: '2 bedrooms', scope: 'local' };
      const checkInvalidType = validateCandidateSchema(invalidType);
      expect(checkInvalidType.success).toBe(false);

      const nonObject = 'string-candidate';
      const checkNonObject = validateCandidateSchema(nonObject);
      expect(checkNonObject.success).toBe(false);
    });

    it('validates semantic finding schema independently', () => {
      const validUncertainty = {
        category: 'uncertainty',
        field: 'price',
        quote: '2M SAR',
        description: 'Estimated price',
      };
      expect(validateSemanticFindingSchema(validUncertainty).success).toBe(true);

      const validMissingContext = {
        category: 'missing_context',
        field: 'district',
        quote: null,
        description: 'District not mentioned',
      };
      expect(validateSemanticFindingSchema(validMissingContext).success).toBe(true);

      const invalidCategory = {
        category: 'hallucination',
        field: 'price',
        quote: '2M SAR',
      };
      expect(validateSemanticFindingSchema(invalidCategory).success).toBe(false);
    });

    it('recovers partially when one candidate has an invalid schema, preserving valid candidates', () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) Villa in Riyadh, 3 bedrooms, 2M SAR',
            candidates: [
              { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
              { field: 'property_type', value: 'invalid_type', quote: 'Villa', scope: 'local' }, // Invalid schema
              { field: 'bedrooms', value: 3, quote: '3 bedrooms', scope: 'local' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(multiOfferText, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.offers[0];
        expect(offer.acceptedCandidates).toHaveLength(2);
        expect(offer.acceptedCandidates.map((c) => c.field)).toEqual(['property_type', 'bedrooms']);
        expect(offer.rejectedCandidates).toHaveLength(1);
        expect(offer.rejectedCandidates[0].reason).toBe('invalid_schema');
      }
    });
  });

  describe('2. Verify source evidence, offer association, and scoping', () => {
    it('executes the handoff example: accepts villa bedrooms, rejects wrong-offer price, accepts apartment bedrooms, accepts shared contact', () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) Villa in Riyadh, 3 bedrooms, 2M SAR',
            candidates: [
              { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
              { field: 'bedrooms', value: 3, quote: '3 bedrooms', scope: 'local' },
              // Incorrectly assigned local evidence belonging to the apartment!
              {
                field: 'price',
                value: { amount: 900000, currency: 'SAR', period: 'total' },
                role: 'asking_price',
                quote: '900K SAR',
                scope: 'local',
              },
              // Shared contact
              { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'shared' },
            ],
            findings: [],
          },
          {
            offer_quote: '2) Apartment in Jeddah, 2 bedrooms, 900K SAR',
            candidates: [
              { field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' },
              { field: 'bedrooms', value: 2, quote: '2 bedrooms', scope: 'local' },
              {
                field: 'price',
                value: { amount: 900000, currency: 'SAR', period: 'total' },
                role: 'asking_price',
                quote: '900K SAR',
                scope: 'local',
              },
              // Shared contact in apartment
              { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'shared' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(multiOfferText, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.offers).toHaveLength(2);

        // Villa offer
        const villaOffer = outcome.offers[0];
        // 3 accepted: property_type, bedrooms, contact_phone (shared)
        expect(villaOffer.acceptedCandidates.map((c) => c.field)).toEqual([
          'property_type',
          'bedrooms',
          'contact_phone',
        ]);
        // 1 rejected: 900K SAR with reason wrong_offer
        expect(villaOffer.rejectedCandidates).toHaveLength(1);
        expect(villaOffer.rejectedCandidates[0]).toMatchObject({
          field: 'price',
          quote: '900K SAR',
          reason: 'wrong_offer',
        });

        // Apartment offer
        const aptOffer = outcome.offers[1];
        // 4 accepted: property_type, bedrooms, price, contact_phone (shared)
        expect(aptOffer.acceptedCandidates.map((c) => c.field)).toEqual([
          'property_type',
          'bedrooms',
          'price',
          'contact_phone',
        ]);
        expect(aptOffer.rejectedCandidates).toHaveLength(0);
      }
    });

    it('rejects fabricated quotes that do not exist anywhere in the source text', () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) Villa in Riyadh, 3 bedrooms, 2M SAR',
            candidates: [
              { field: 'property_type', value: 'villa', quote: 'Luxury Palace', scope: 'local' }, // Fabricated
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(multiOfferText, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.offers[0];
        expect(offer.acceptedCandidates).toHaveLength(0);
        expect(offer.rejectedCandidates).toHaveLength(1);
        expect(offer.rejectedCandidates[0]).toMatchObject({
          field: 'property_type',
          quote: 'Luxury Palace',
          reason: 'quote_not_in_source',
        });
      }
    });

    it('rejects clipped word and number tokens', () => {
      const text = 'Villa with 380 sqm built-up at -50,000 SAR discount and 2,500 SAR/sqm';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: text,
            candidates: [
              // 1. Alphanumeric cut: "illa" from "Villa"
              { field: 'property_type', value: 'villa', quote: 'illa', scope: 'local' },
              // 2. Sign cut: "50,000" from "-50,000"
              {
                field: 'price',
                value: { amount: 50000, currency: 'SAR', period: 'total' },
                role: 'deposit',
                quote: '50,000',
                scope: 'local',
              },
              // 3. Unit slash cut: "2,500 SAR" from "2,500 SAR/sqm"
              {
                field: 'price',
                value: { amount: 2500, currency: 'SAR', period: null },
                role: 'per_sqm_rate',
                quote: '2,500 SAR',
                scope: 'local',
              },
              // 4. Valid unclipped candidate
              { field: 'area_sqm', value: 380, kind: 'built_up', quote: '380 sqm built-up', scope: 'local' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(text, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.offers[0];
        expect(offer.acceptedCandidates).toHaveLength(1);
        expect(offer.acceptedCandidates[0].field).toBe('area_sqm');

        expect(offer.rejectedCandidates).toHaveLength(3);
        expect(offer.rejectedCandidates.map((r) => r.reason)).toEqual([
          'clipped_token',
          'clipped_token',
          'clipped_token',
        ]);
      }
    });

    it('allows attached Arabic conjunction و without treating it as clipping', () => {
      const arabicText = 'للبيع فيلا وشقة في الرياض';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: 'للبيع فيلا وشقة في الرياض',
            candidates: [
              { field: 'purpose', value: 'sale', quote: 'للبيع', scope: 'local' },
              { field: 'property_type', value: 'villa', quote: 'فيلا', scope: 'local' },
              // 'وشقة' in source text, quote is 'شقة' (starts right after attached 'و')
              { field: 'property_type', value: 'apartment', quote: 'شقة', scope: 'local' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(arabicText, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.offers[0];
        expect(offer.acceptedCandidates.map((c) => c.quote)).toContain('شقة');
      }
    });

    it('rejects shared evidence that belongs exclusively to another offer', () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) Villa in Riyadh, 3 bedrooms, 2M SAR',
            candidates: [
              { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
              // "Jeddah" occurs strictly inside the apartment offer quote and nowhere in shared context!
              { field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'shared' },
            ],
            findings: [],
          },
          {
            offer_quote: '2) Apartment in Jeddah, 2 bedrooms, 900K SAR',
            candidates: [
              { field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' },
              { field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'local' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(multiOfferText, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const villaOffer = outcome.offers[0];
        expect(villaOffer.acceptedCandidates).toHaveLength(1);
        expect(villaOffer.rejectedCandidates).toHaveLength(1);
        expect(villaOffer.rejectedCandidates[0]).toMatchObject({
          field: 'city',
          quote: 'Jeddah',
          scope: 'shared',
          reason: 'unscoped_shared_evidence',
        });
      }
    });
  });

  describe('3. Repeated quotes & offer scoping', () => {
    it('disambiguates identical wording across multiple offers using offer scoping', () => {
      const text = [
        '1) For sale: Villa in Riyadh, 3 bedrooms',
        '2) For sale: Apartment in Riyadh, 2 bedrooms',
      ].join('\n');

      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) For sale: Villa in Riyadh, 3 bedrooms',
            candidates: [
              { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
              { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
            ],
            findings: [],
          },
          {
            offer_quote: '2) For sale: Apartment in Riyadh, 2 bedrooms',
            candidates: [
              { field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' },
              { field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(text, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        // Both offers accept "For sale" and "Riyadh" because each quote is uniquely scoped to its offer!
        expect(outcome.offers[0].acceptedCandidates).toHaveLength(2);
        expect(outcome.offers[1].acceptedCandidates).toHaveLength(2);
        expect(outcome.offers[0].rejectedCandidates).toHaveLength(0);
        expect(outcome.offers[1].rejectedCandidates).toHaveLength(0);
      }
    });

    it('rejects quotes that appear multiple times ambiguously within the SAME offer', () => {
      const text = 'Villa with 3 bedrooms, but permits allow 3 bedrooms extension';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: text,
            candidates: [
              // '3 bedrooms' appears twice in this exact offer quote
              { field: 'bedrooms', value: 3, quote: '3 bedrooms', scope: 'local' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(text, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.offers[0];
        expect(offer.acceptedCandidates).toHaveLength(0);
        expect(offer.rejectedCandidates).toHaveLength(1);
        expect(offer.rejectedCandidates[0]).toMatchObject({
          field: 'bedrooms',
          quote: '3 bedrooms',
          reason: 'multiple_occurrences',
        });
      }
    });
  });

  describe('4. Semantic findings validation (Task 02.3 merged into 02.2)', () => {
    it('preserves valid grounded semantic findings and missing context', () => {
      const text = 'Villa in Riyadh. Price around market average. 3 BR ... 4 BR';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: text,
            candidates: [{ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }],
            findings: [
              {
                category: 'uncertainty',
                field: 'price',
                quote: 'Price around market average',
                description: 'Uncertain price',
              },
              {
                category: 'contradiction',
                field: 'bedrooms',
                quote: '3 BR ... 4 BR',
                description: 'Competing bedroom counts',
              },
              {
                category: 'missing_context',
                field: 'district',
                quote: null,
                description: 'District omitted',
              },
            ],
          },
        ],
      };

      const outcome = validateStage2(text, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.offers[0];
        expect(offer.semanticFindings).toHaveLength(3);
        expect(offer.rejectedFindings).toHaveLength(0);
      }
    });

    it('rejects invalid or ungrounded semantic findings without failing the offer', () => {
      const text = '1) Villa in Riyadh. 2) Apartment in Jeddah.';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) Villa in Riyadh.',
            candidates: [{ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }],
            findings: [
              // 1. Invalid schema: non-existent category
              { category: 'hallucination', field: 'price' },
              // 2. Fabricated quote
              { category: 'uncertainty', field: 'price', quote: 'Fabricated quote' },
              // 3. Clipped quote: "iyadh" from "Riyadh"
              { category: 'uncertainty', field: 'city', quote: 'iyadh' },
              // 4. Wrong offer: "Jeddah" belongs exclusively to offer 2
              { category: 'contradiction', field: 'city', quote: 'Jeddah' },
              // 5. Valid grounded finding
              { category: 'uncertainty', field: 'property_type', quote: 'Villa', description: 'Grounded' },
            ],
          },
          {
            offer_quote: '2) Apartment in Jeddah.',
            candidates: [{ field: 'property_type', value: 'apartment', quote: 'Apartment', scope: 'local' }],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(text, payload);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer1 = outcome.offers[0];
        // Only the valid grounded finding survives
        expect(offer1.semanticFindings).toHaveLength(1);
        expect(offer1.semanticFindings[0].description).toBe('Grounded');

        // 4 rejected findings with appropriate reasons
        expect(offer1.rejectedFindings).toHaveLength(4);
        expect(offer1.rejectedFindings.map((r) => r.reason)).toEqual([
          'invalid_schema',
          'quote_not_in_source',
          'clipped_token',
          'wrong_offer',
        ]);
        // Valid candidate in offer 1 is unaffected
        expect(offer1.acceptedCandidates).toHaveLength(1);
      }
    });
  });

  describe('5. Envelope failure & offer ungrounded policy', () => {
    it('fails with invalid_extraction when claimed property offers cannot be grounded in source text', () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: 'Completely fabricated offer text not in source',
            candidates: [],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2('Real source text with no match', payload);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.code).toBe('invalid_extraction');
        expect(outcome.error.message).toContain('grounded');
      }
    });

    it('fails with invalid_extraction for malformed envelopes', () => {
      expect(validateStage2(multiOfferText, null)).toEqual({
        ok: false,
        error: { code: 'invalid_extraction', message: expect.stringContaining('not an object') },
      });

      expect(validateStage2(multiOfferText, { classification: 'invalid' })).toEqual({
        ok: false,
        error: { code: 'invalid_extraction', message: expect.stringContaining('Invalid classification') },
      });
    });

    it('returns empty offers for valid non-listing single intents', () => {
      const buyerRequest = {
        classification: 'buyer_request',
        detected_classes: ['buyer_request'],
        listings: [],
      };
      const outcome = validateStage2('Looking for a villa in Riyadh', buyerRequest);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.classification).toBe('buyer_request');
        expect(outcome.offers).toHaveLength(0);
      }
    });
  });

  describe('6. Integration with ExtractionService', () => {
    it('routes gateway payload through Stage 2 and populates rejectedEvidence and validationOutcomes', async () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: '1) Villa in Riyadh, 3 bedrooms, 2M SAR',
            candidates: [
              { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
              // Fabricated candidate
              { field: 'city', value: 'Dammam', quote: 'Dammam', scope: 'local' },
            ],
            findings: [
              // Valid finding
              { category: 'uncertainty', field: 'price', quote: '2M SAR', description: 'Approximate' },
              // Fabricated finding
              { category: 'uncertainty', field: 'city', quote: 'Fabricated', description: 'No quote' },
            ],
          },
        ],
      };

      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(multiOfferRawMessage);

      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const offer = outcome.result.listings[0];
        // Critical invariant: only accepted candidates and findings are present!
        expect(offer.candidates).toHaveLength(1);
        expect(offer.candidates[0].field).toBe('property_type');
        expect(offer.findings).toHaveLength(1);
        expect(offer.findings[0].description).toBe('Approximate');

        // Rejected evidence is captured
        expect(outcome.rejectedEvidence).toHaveLength(2);
        expect(outcome.rejectedEvidence?.map((r) => r.reason)).toEqual([
          'quote_not_in_source',
          'quote_not_in_source',
        ]);
        expect(outcome.result.validationOutcomes).toBeDefined();
        expect(outcome.result.validationOutcomes?.[0].acceptedCandidates).toHaveLength(1);
      }
    });
  });
});
