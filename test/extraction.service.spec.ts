import { z } from 'zod';
import { DOMAIN_INSTRUCTIONS } from '../src/extraction/domain-prompt';
import {
  ExtractedOffer,
  Stage1ExtractionResult,
  stage1GatewayWireSchema,
} from '../src/extraction/extraction-result.schema';
import { ExtractionService } from '../src/extraction/extraction.service';
import { LlmGateway, ProviderError } from '../src/llm-gateway/llm-request';
import { RawMessage } from '../src/messages/raw-message.schema';

const sampleMessage: RawMessage = {
  id: 'm-001',
  sender: 'broker',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh, Al Malqa. 5 BR, 6 baths, 380 sqm built-up. Asking 3.2M SAR. Call 0551234567',
};

const validSaleOffer: ExtractedOffer = {
  offer_quote: 'For sale: Villa in Riyadh, Al Malqa. 5 BR, 6 baths, 380 sqm built-up. Asking 3.2M SAR. Call 0551234567',
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
};

const validEnvelope: Stage1ExtractionResult = {
  classification: 'listing',
  detected_classes: ['listing'],
  listings: [validSaleOffer],
};

describe('02.1T — Extraction: Stage 1 contract, schema, prompt, and matrix', () => {
  it('makes exactly one call with byte-for-byte source preservation, derived schema, and 9 ordered instructions', async () => {
    const execute = jest.fn<ReturnType<LlmGateway['execute']>, Parameters<LlmGateway['execute']>>().mockResolvedValue(validEnvelope);
    const service = new ExtractionService({ execute });

    const outcome = await service.extract(sampleMessage);
    expect(outcome.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);

    const request = execute.mock.calls[0][0];
    // Byte-for-byte source preservation
    expect(request.sourceText).toBe(sampleMessage.text);

    // Derived JSON Schema
    const expectedSchema = z.toJSONSchema(stage1GatewayWireSchema, { target: 'draft-7' });
    expect(request.responseSchema).toEqual(expectedSchema);
    expect(request.responseSchema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['classification', 'detected_classes', 'listings']),
      properties: {
        classification: { enum: expect.arrayContaining(['listing', 'project', 'buyer_request', 'irrelevant', 'mixed']) },
        detected_classes: { type: 'array' },
        listings: { type: 'array' },
      },
    });

    // All 9 instructions in order
    const instructions = request.instructions;
    expect(instructions).toBe(DOMAIN_INSTRUCTIONS);
    const steps = [
      '1. Classify:',
      '2. Segment:',
      '3. Associate:',
      '4. Extract:',
      '5. Interpret:',
      '6. Normalize:',
      '7. Verify evidence-to-value consistency:',
      '8. Assess consistency:',
      '9. Produce structured output:',
    ];
    let lastIndex = -1;
    for (const step of steps) {
      const idx = instructions.indexOf(step);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }

    // Prompt includes required representative examples
    expect(instructions).toContain('للبيع شقة ٣ غرف نوم');
    expect(instructions).toContain('Villa for sale in City: Riyadh');
    expect(instructions).toContain('مرحبا، للبيع شقة 3 غرف');
    expect(instructions).toContain('مشروع أبراج النرجس');
    expect(instructions).toContain('1) Studio 35K 2) Villa 80K');
    expect(instructions).toContain('فيلا أربع غرف نوم');
    expect(instructions).toContain('العربون 50 ألف ريال');
    expect(instructions).toContain('2500 ريال للمتر');
    expect(instructions).toContain('85,000/yr');
  });

  describe('classification matrix rows', () => {
    it.each([
      ['Row 1: Single listing', { classification: 'listing', detected_classes: ['listing'], listings: [validSaleOffer] }],
      ['Row 2: Off-plan project announcement', { classification: 'project', detected_classes: ['project'], listings: [] }],
      ['Row 3: Buyer request', { classification: 'buyer_request', detected_classes: ['buyer_request'], listings: [] }],
      ['Row 4: Irrelevant/greetings only', { classification: 'irrelevant', detected_classes: ['irrelevant'], listings: [] }],
      ['Row 5: Mixed listing and buyer request', { classification: 'mixed', detected_classes: ['listing', 'buyer_request'], listings: [validSaleOffer] }],
      ['Row 6: Mixed project and buyer request', { classification: 'mixed', detected_classes: ['project', 'buyer_request'], listings: [] }],
      ['Row 7: Mixed project and independent offer', { classification: 'mixed', detected_classes: ['project', 'listing'], listings: [validSaleOffer] }],
    ])('accepts valid envelope for %s', async (_name, payload) => {
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.classification).toBe(payload.classification);
        expect(outcome.result.detected_classes).toEqual(payload.detected_classes);
        expect(outcome.result.listings).toHaveLength(payload.listings.length);
      }
    });

    it('preserves reordered substantive intents in source order', async () => {
      const payloadReordered = {
        classification: 'mixed',
        detected_classes: ['buyer_request', 'listing'],
        listings: [validSaleOffer],
      };
      const service = new ExtractionService({ execute: async () => payloadReordered });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.detected_classes).toEqual(['buyer_request', 'listing']);
      }
    });

    it('rejects duplicate detected classes', async () => {
      const payloadDuplicate = {
        classification: 'mixed',
        detected_classes: ['listing', 'listing'],
        listings: [validSaleOffer],
      };
      const service = new ExtractionService({ execute: async () => payloadDuplicate });
      const outcome = await service.extract(sampleMessage);
      expect(outcome).toEqual({
        ok: false,
        failure: { message_id: sampleMessage.id, error: { code: 'invalid_extraction', message: 'Invalid extraction response' } },
      });
    });

    it('maintains single intent classification for messages with incidental greetings', async () => {
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [validSaleOffer],
      };
      const greetingMessage = { ...sampleMessage, text: 'Hello, ' + sampleMessage.text };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(greetingMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.classification).toBe('listing');
        expect(outcome.result.detected_classes).toEqual(['listing']);
      }
    });

    it('supports multiple offers of one class in source order', async () => {
      const secondOffer: ExtractedOffer = {
        offer_quote: 'Second apartment for sale',
        candidates: [
          { field: 'purpose', value: 'sale', quote: 'for sale', scope: 'local' },
          { field: 'property_type', value: 'apartment', quote: 'apartment', scope: 'local' },
        ],
        findings: [],
      };
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [validSaleOffer, secondOffer],
      };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.listings).toHaveLength(2);
        expect(outcome.result.listings[0].offer_quote).toBe(validSaleOffer.offer_quote);
        expect(outcome.result.listings[1].offer_quote).toBe(secondOffer.offer_quote);
      }
    });
  });

  describe('field variants, scopes, qualified prices, and findings', () => {
    it('preserves local versus shared candidate evidence', async () => {
      const offerWithSharedContact: ExtractedOffer = {
        offer_quote: 'Offer text',
        candidates: [
          { field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' },
          { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'shared' },
        ],
        findings: [],
      };
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [offerWithSharedContact],
      };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const candidates = outcome.result.listings[0].candidates;
        expect(candidates.find((c) => c.field === 'property_type')?.scope).toBe('local');
        expect(candidates.find((c) => c.field === 'contact_phone')?.scope).toBe('shared');
      }
    });

    it('exercises all nine field variants and qualifiers', async () => {
      const allFieldsOffer: ExtractedOffer = {
        offer_quote: 'Complete property offer',
        candidates: [
          { field: 'purpose', value: 'rent', quote: 'for rent', scope: 'local' },
          { field: 'property_type', value: 'townhouse', quote: 'townhouse', scope: 'local' },
          { field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'local' },
          { field: 'district', value: 'Al Rawdah', quote: 'Al Rawdah', scope: 'local' },
          { field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' },
          { field: 'bathrooms', value: 3, quote: '3 baths', scope: 'local' },
          { field: 'area_sqm', value: 450, kind: 'land', quote: '450 sqm land', scope: 'local' },
          {
            field: 'price',
            value: { amount: 120000, currency: 'SAR', period: 'yearly' },
            role: 'asking_price',
            quote: '120k SAR / yr',
            scope: 'local',
          },
          { field: 'contact_phone', value: '+966559876543', quote: '0559876543', scope: 'local' },
        ],
        findings: [],
      };
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [allFieldsOffer],
      };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.listings[0].candidates).toHaveLength(9);
      }
    });

    it('preserves qualified price roles: deposit, installment, per_sqm_rate', async () => {
      const qualifiedPricesOffer: ExtractedOffer = {
        offer_quote: 'Multiple price assertions',
        candidates: [
          {
            field: 'price',
            value: { amount: 3200000, currency: 'SAR', period: 'total' },
            role: 'asking_price',
            quote: 'Asking 3.2M SAR',
            scope: 'local',
          },
          {
            field: 'price',
            value: { amount: 50000, currency: 'SAR', period: 'total' },
            role: 'deposit',
            quote: 'Deposit 50,000 SAR',
            scope: 'local',
          },
          {
            field: 'price',
            value: { amount: 2500, currency: 'SAR', period: null },
            role: 'per_sqm_rate',
            quote: '2,500 SAR/sqm',
            scope: 'local',
          },
        ],
        findings: [],
      };
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [qualifiedPricesOffer],
      };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const prices = outcome.result.listings[0].candidates.filter((c) => c.field === 'price') as any[];
        expect(prices.map((p) => p.role)).toEqual(['asking_price', 'deposit', 'per_sqm_rate']);
      }
    });

    it('preserves competing candidates for the same field', async () => {
      const competingOffer: ExtractedOffer = {
        offer_quote: 'Villa 3 BR updated to 4 BR',
        candidates: [
          { field: 'bedrooms', value: 3, quote: '3 BR', scope: 'local' },
          { field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' },
        ],
        findings: [],
      };
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [competingOffer],
      };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.listings[0].candidates).toHaveLength(2);
      }
    });

    it('preserves structured bounded findings', async () => {
      const offerWithFindings: ExtractedOffer = {
        offer_quote: 'Uncertain price description',
        candidates: [],
        findings: [
          {
            category: 'uncertainty',
            field: 'price',
            quote: 'Price around market average',
            description: 'No numeric amount stated',
          },
          {
            category: 'contradiction',
            field: 'bedrooms',
            quote: '3 BR ... 4 BR',
            description: 'Conflicting bedroom counts',
          },
          {
            category: 'missing_context',
            field: 'district',
            quote: null,
            description: 'District omitted',
          },
        ],
      };
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [offerWithFindings],
      };
      const service = new ExtractionService({ execute: async () => payload });
      const outcome = await service.extract(sampleMessage);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.listings[0].findings).toEqual(offerWithFindings.findings);
      }
    });
  });

  describe('unusable envelopes and failure rejection', () => {
    it.each([
      ['null output', null],
      ['non-object output', 'raw string'],
      ['missing classification', { detected_classes: ['listing'], listings: [validSaleOffer] }],
      ['invalid classification enum', { classification: 'unknown', detected_classes: ['listing'], listings: [validSaleOffer] }],
      ['missing detected_classes', { classification: 'listing', listings: [validSaleOffer] }],
      ['detected_classes not an array', { classification: 'listing', detected_classes: 'listing', listings: [validSaleOffer] }],
      ['detected_classes contains "mixed"', { classification: 'mixed', detected_classes: ['listing', 'mixed'], listings: [validSaleOffer] }],
      ['single intent with multiple detected_classes', { classification: 'listing', detected_classes: ['listing', 'project'], listings: [validSaleOffer] }],
      ['single intent with mismatched detected_class', { classification: 'listing', detected_classes: ['project'], listings: [validSaleOffer] }],
      ['mixed with only 1 detected_class', { classification: 'mixed', detected_classes: ['listing'], listings: [validSaleOffer] }],
      ['listing detected but listings array is empty', { classification: 'listing', detected_classes: ['listing'], listings: [] }],
      ['listing not detected but listings array has offers', { classification: 'project', detected_classes: ['project'], listings: [validSaleOffer] }],
      ['offer missing offer_quote', { classification: 'listing', detected_classes: ['listing'], listings: [{ candidates: [], findings: [] }] }],
      ['offer missing candidates array', { classification: 'listing', detected_classes: ['listing'], listings: [{ offer_quote: 'q', findings: [] }] }],
      ['offer missing findings array', { classification: 'listing', detected_classes: ['listing'], listings: [{ offer_quote: 'q', candidates: [] }] }],
    ])('rejects unusable envelope with invalid_extraction: %s', async (_name, payload) => {
      const service = new ExtractionService({ execute: async () => payload });
      expect(await service.extract(sampleMessage)).toEqual({
        ok: false,
        failure: {
          message_id: sampleMessage.id,
          error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
        },
      });
    });

    it('maps ProviderError for unavailable provider', async () => {
      const service = new ExtractionService({
        execute: async () => {
          throw new ProviderError('provider_unavailable', 'API rate limit exceeded');
        },
      });
      expect(await service.extract(sampleMessage)).toEqual({
        ok: false,
        failure: {
          message_id: sampleMessage.id,
          error: { code: 'provider_unavailable', message: 'API rate limit exceeded' },
        },
      });
    });

    it('maps ProviderError for provider timeout', async () => {
      const service = new ExtractionService({
        execute: async () => {
          throw new ProviderError('provider_timeout', 'Request timed out after 45000ms');
        },
      });
      expect(await service.extract(sampleMessage)).toEqual({
        ok: false,
        failure: {
          message_id: sampleMessage.id,
          error: { code: 'provider_timeout', message: 'Request timed out after 45000ms' },
        },
      });
    });
  });
});
