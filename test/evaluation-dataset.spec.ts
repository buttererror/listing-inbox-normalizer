import * as fs from 'node:fs';
import * as path from 'node:path';
import { rawMessageSchema, RawMessage } from '../src/messages/raw-message.schema';
import {
  messageClassificationSchema,
  baseClassificationSchema,
  listingResultSchema,
  BaseClassification,
  MessageClassification,
} from '../src/messages/message-result.schema';
import { REVIEW_REASON_LABELS } from '../src/listings/review-labels';

interface ExpectedListing {
  offer_index: number;
  purpose: 'sale' | 'rent' | null;
  property_type: 'villa' | 'apartment' | 'studio' | 'land' | 'townhouse' | 'other' | null;
  city: string | null;
  district: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  price: {
    amount: number | null;
    currency: 'SAR';
    period: 'total' | 'yearly' | 'monthly' | null;
  };
  contact_phone: string | null;
  needs_review: boolean;
  review_reasons: string[];
  inapplicable_fields: string[];
  traceability?: Record<string, string>;
}

interface ExpectedCase {
  message_id: string;
  language: 'arabic' | 'english' | 'mixed';
  scenario: string;
  classification: MessageClassification;
  detected_classes: BaseClassification[];
  offer_count: number;
  listings: ExpectedListing[];
}

interface ExpectedDataset {
  version: string;
  description: string;
  language_distribution: {
    arabic: number;
    english: number;
    mixed: number;
    total: number;
  };
  cases: ExpectedCase[];
}

describe('Evaluation Dataset (Task 03.1)', () => {
  const casesPath = path.resolve(__dirname, 'evaluation/cases.jsonl');
  const expectedPath = path.resolve(__dirname, 'evaluation/expected.json');

  let casesLines: string[];
  let rawMessages: RawMessage[];
  let expectedData: ExpectedDataset;

  beforeAll(() => {
    expect(fs.existsSync(casesPath)).toBe(true);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const rawCasesContent = fs.readFileSync(casesPath, 'utf-8').trim();
    casesLines = rawCasesContent.split('\n').filter((line) => line.trim().length > 0);
    rawMessages = casesLines.map((line) => JSON.parse(line));
    expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
  });

  describe('Dataset Structure and Distribution', () => {
    it('contains exactly 20 messages in cases.jsonl', () => {
      expect(rawMessages).toHaveLength(20);
    });

    it('contains exactly 20 corresponding cases in expected.json', () => {
      expect(expectedData.cases).toHaveLength(20);
    });

    it('has exact 1-to-1 match between cases.jsonl and expected.json IDs in order', () => {
      const caseIds = rawMessages.map((m) => m.id);
      const expectedIds = expectedData.cases.map((c) => c.message_id);
      expect(expectedIds).toEqual(caseIds);
    });

    it('satisfies the required language distribution (8 Arabic, 6 English, 6 Mixed)', () => {
      const distribution = {
        arabic: expectedData.cases.filter((c) => c.language === 'arabic').length,
        english: expectedData.cases.filter((c) => c.language === 'english').length,
        mixed: expectedData.cases.filter((c) => c.language === 'mixed').length,
      };

      expect(distribution.arabic).toBe(8);
      expect(distribution.english).toBe(6);
      expect(distribution.mixed).toBe(6);
      expect(distribution.arabic + distribution.english + distribution.mixed).toBe(20);
      expect(expectedData.language_distribution).toEqual({
        arabic: 8,
        english: 6,
        mixed: 6,
        total: 20,
      });
    });
  });

  describe('Raw Message Schema Compliance', () => {
    it('validates every message in cases.jsonl against rawMessageSchema', () => {
      for (const msg of rawMessages) {
        const parsed = rawMessageSchema.safeParse(msg);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.id).toMatch(/^eval-\d{3}$/);
          expect(parsed.data.text.trim().length).toBeGreaterThan(10);
          expect(parsed.data.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        }
      }
    });
  });

  describe('Expected Public Output Contract & Classification', () => {
    it('validates every classification and detected_classes list', () => {
      for (const c of expectedData.cases) {
        expect(() => messageClassificationSchema.parse(c.classification)).not.toThrow();
        expect(c.detected_classes.length).toBeGreaterThanOrEqual(1);
        for (const dc of c.detected_classes) {
          expect(() => baseClassificationSchema.parse(dc)).not.toThrow();
        }

        if (c.classification === 'mixed') {
          expect(c.detected_classes.length).toBeGreaterThanOrEqual(2);
          expect(c.detected_classes).not.toContain('mixed');
        } else {
          expect(c.detected_classes).toEqual([c.classification]);
        }
      }
    });

    it('guarantees non-listing intents (buyer_request, irrelevant, standalone project) have 0 listings', () => {
      for (const c of expectedData.cases) {
        if (['buyer_request', 'irrelevant', 'project'].includes(c.classification)) {
          expect(c.offer_count).toBe(0);
          expect(c.listings).toEqual([]);
        }
      }
    });

    it('validates every expected listing against public listingResultSchema', () => {
      for (const c of expectedData.cases) {
        expect(c.listings.length).toBe(c.offer_count);
        for (const listing of c.listings) {
          const contractShape = {
            id: `test-${c.message_id}-${listing.offer_index}`,
            purpose: listing.purpose,
            property_type: listing.property_type,
            city: listing.city,
            district: listing.district,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            area_sqm: listing.area_sqm,
            price: listing.price,
            contact_phone: listing.contact_phone,
            needs_review: listing.needs_review,
            review_reasons: listing.review_reasons,
            duplicate_of: null,
          };
          const parsed = listingResultSchema.safeParse(contractShape);
          expect(parsed.success).toBe(true);
        }
      }
    });

    it('uses only valid runtime review reasons from REVIEW_REASON_LABELS', () => {
      const validCodes = new Set(Object.keys(REVIEW_REASON_LABELS));
      for (const c of expectedData.cases) {
        for (const listing of c.listings) {
          for (const reason of listing.review_reasons) {
            expect(validCodes.has(reason)).toBe(true);
          }
          if (listing.review_reasons.length > 0) {
            expect(listing.needs_review).toBe(true);
          } else {
            expect(listing.needs_review).toBe(false);
          }
        }
      }
    });
  });

  describe('Source Traceability and Inapplicable Fields', () => {
    it('verifies that each expected listing is traceable to its source message text', () => {
      const rawMap = new Map(rawMessages.map((m) => [m.id, m]));

      for (const c of expectedData.cases) {
        const raw = rawMap.get(c.message_id);
        expect(raw).toBeDefined();
        if (!raw) continue;

        for (const listing of c.listings) {
          expect(listing.traceability).toBeDefined();
          const trace = listing.traceability!;

          // Check that quotes exist in source text (allowing normalized whitespace)
          for (const [field, quote] of Object.entries(trace)) {
            const rawNormalized = raw.text.replace(/\s+/g, ' ');
            const quoteNormalized = quote.replace(/\s+/g, ' ');
            expect(rawNormalized.includes(quoteNormalized)).toBe(true);
          }
        }
      }
    });

    it('distinguishes inapplicable fields from missing applicable fields', () => {
      for (const c of expectedData.cases) {
        for (const listing of c.listings) {
          if (listing.property_type === 'land') {
            expect(listing.inapplicable_fields).toContain('bedrooms');
            expect(listing.inapplicable_fields).toContain('bathrooms');
            expect(listing.bedrooms).toBeNull();
            expect(listing.bathrooms).toBeNull();
            // Should NOT have bedrooms_missing or bathrooms_missing in review_reasons
            expect(listing.review_reasons).not.toContain('bedrooms_missing');
            expect(listing.review_reasons).not.toContain('bathrooms_missing');
          } else if (listing.property_type === 'studio') {
            expect(listing.inapplicable_fields).toContain('bedrooms');
            expect(listing.bedrooms).toBeNull();
            expect(listing.review_reasons).not.toContain('bedrooms_missing');
          }
        }
      }
    });
  });
});
