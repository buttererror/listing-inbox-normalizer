import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/cli';
import { TypedFieldCandidate } from '../src/extraction/extraction-result.schema';
import {
  OfferValidationOutcome,
  validateStage2,
} from '../src/extraction/stage2-mechanical-validation';
import { resolveOffer } from '../src/listings/resolve-offer';
import {
  formatReviewReason,
  REVIEW_REASON_LABELS,
  reviewResolvedOffer,
} from '../src/listings/runtime-reviewer';
import { MessageProcessor } from '../src/messages/message-processor';

function baseValidCandidates(): TypedFieldCandidate[] {
  return [
    { field: 'purpose', value: 'sale', quote: 'للبيع', scope: 'local' },
    { field: 'property_type', value: 'villa', quote: 'فيلا', scope: 'local' },
    { field: 'city', value: 'الرياض', quote: 'الرياض', scope: 'local' },
    { field: 'district', value: 'الملقا', quote: 'الملقا', scope: 'local' },
    { field: 'bedrooms', value: 4, quote: '٤ غرف', scope: 'local' },
    { field: 'bathrooms', value: 5, quote: '٥ دورات مياه', scope: 'local' },
    { field: 'area_sqm', value: 350, kind: 'built_up', quote: '٣٥٠ م', scope: 'local' },
    {
      field: 'price',
      value: { amount: 2500000, currency: 'SAR', period: 'total' },
      role: 'asking_price',
      quote: '٢،٥٠٠،٠٠٠ ريال',
      scope: 'local',
    },
    { field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'local' },
  ];
}

function createOutcome(
  accepted: TypedFieldCandidate[] = [],
  overrides: Partial<OfferValidationOutcome> = {},
): OfferValidationOutcome {
  return {
    offer_index: 0,
    offer_quote: 'فيلا للبيع في الرياض حي الملقا',
    acceptedCandidates: accepted,
    rejectedCandidates: [],
    semanticFindings: [],
    rejectedFindings: [],
    validationFindings: [],
    ...overrides,
  };
}

describe('Human-Friendly Review Reasons & Presentation', () => {
  describe('1. Business-level review reasons vs Technical validation codes', () => {
    it('produces business-level bedrooms_unsupported when an invalid bedroom candidate has no replacement', () => {
      // Invalidate bedrooms: candidate rejected in Stage 2
      const acceptedWithoutBedrooms = baseValidCandidates().filter((c) => c.field !== 'bedrooms');
      const outcome = createOutcome(acceptedWithoutBedrooms, {
        rejectedCandidates: [
          {
            candidate: { field: 'bedrooms', value: 'invalid_val', quote: 'invalid' },
            field: 'bedrooms',
            quote: 'invalid',
            reason: 'invalid_schema',
            message: 'Invalid input: expected number',
          },
        ],
      });

      const resolved = resolveOffer(outcome);
      const review = reviewResolvedOffer(resolved);

      expect(review.needs_review).toBe(true);
      expect(review.review_reasons).toContain('bedrooms_unsupported');
      // Technical code must not leak into review_reasons
      expect(review.review_reasons).not.toContain('invalid_schema');
      // Human presentation label
      expect(formatReviewReason('bedrooms_unsupported')).toBe('Bedroom count is missing or unreliable');
    });

    it('does not trigger review solely for rejection when an invalid candidate has a valid replacement', () => {
      // One invalid bedroom candidate and one valid bedroom candidate
      const accepted = baseValidCandidates();
      const outcome = createOutcome(accepted, {
        rejectedCandidates: [
          {
            candidate: { field: 'bedrooms', value: -1, quote: 'invalid' },
            field: 'bedrooms',
            quote: 'invalid',
            reason: 'invalid_numeric_constraint',
          },
        ],
      });

      const resolved = resolveOffer(outcome);
      const review = reviewResolvedOffer(resolved);

      expect(resolved.fields.bedrooms).toBe(4);
      expect(review.needs_review).toBe(false);
      expect(review.review_reasons).toEqual([]);
    });

    it('produces price_conflict for competing asking prices', () => {
      const candidates = baseValidCandidates().filter((c) => c.field !== 'price');
      candidates.push(
        {
          field: 'price',
          value: { amount: 2000000, currency: 'SAR', period: 'total' },
          role: 'asking_price',
          quote: '٢ مليون',
          scope: 'local',
        },
        {
          field: 'price',
          value: { amount: 2500000, currency: 'SAR', period: 'total' },
          role: 'asking_price',
          quote: '٢.٥ مليون',
          scope: 'local',
        },
      );

      const resolved = resolveOffer(createOutcome(candidates));
      const review = reviewResolvedOffer(resolved);

      expect(review.needs_review).toBe(true);
      expect(review.review_reasons).toContain('price_conflict');
      expect(formatReviewReason('price_conflict')).toBe('Conflicting asking prices');
    });

    it('produces price_missing when asking price is absent', () => {
      const candidates = baseValidCandidates().filter((c) => c.field !== 'price');
      const resolved = resolveOffer(createOutcome(candidates));
      const review = reviewResolvedOffer(resolved);

      expect(review.needs_review).toBe(true);
      expect(review.review_reasons).toContain('price_missing');
      expect(formatReviewReason('price_missing')).toBe('Asking price is missing');
    });

    it('produces price_currency_unknown when currency cannot be confirmed', () => {
      const candidates = baseValidCandidates().filter((c) => c.field !== 'price');
      candidates.push({
        field: 'price',
        value: { amount: 1500000, currency: null, period: 'total' },
        role: 'asking_price',
        quote: 'مليون ونصف',
        scope: 'local',
      });

      const resolved = resolveOffer(createOutcome(candidates));
      const review = reviewResolvedOffer(resolved);

      expect(review.needs_review).toBe(true);
      expect(review.review_reasons).toContain('price_currency_unknown');
      expect(formatReviewReason('price_currency_unknown')).toBe('Price currency could not be confirmed');
    });

    it('produces district_missing when district is missing', () => {
      const candidates = baseValidCandidates().filter((c) => c.field !== 'district');
      const resolved = resolveOffer(createOutcome(candidates));
      const review = reviewResolvedOffer(resolved);

      expect(review.needs_review).toBe(true);
      expect(review.review_reasons).toContain('district_missing');
      expect(formatReviewReason('district_missing')).toBe('District is missing');
    });

    it('ensures technical validation codes never leak into public review_reasons', () => {
      const technicalCodes = [
        'invalid_schema',
        'invalid_format',
        'quote_not_in_source',
        'wrong_offer',
        'clipped_token',
        'invalid_numeric_constraint',
      ];

      const outcome = createOutcome([], {
        rejectedCandidates: technicalCodes.map((reason) => ({
          candidate: {},
          field: 'price',
          quote: 'foo',
          reason: reason as any,
        })),
      });

      const resolved = resolveOffer(outcome);
      const review = reviewResolvedOffer(resolved);

      for (const techCode of technicalCodes) {
        expect(review.review_reasons).not.toContain(techCode);
      }
    });
  });

  describe('2. Review reason presentation mapping and fallback', () => {
    it('maps known review codes to accurate business labels', () => {
      expect(formatReviewReason('bedrooms_missing')).toBe('Bedroom count is missing');
      expect(formatReviewReason('price_conflict')).toBe('Conflicting asking prices');
      expect(formatReviewReason('price_missing')).toBe('Asking price is missing');
      expect(formatReviewReason('price_currency_unknown')).toBe('Price currency could not be confirmed');
      expect(formatReviewReason('district_missing')).toBe('District is missing');
      expect(formatReviewReason('bedrooms_unsupported')).toBe('Bedroom count is missing or unreliable');
    });

    it('provides a safe, readable fallback for unknown review codes without crashing', () => {
      expect(formatReviewReason('unknown_review_code')).toBe('Unknown review code');
      expect(formatReviewReason('custom_verification_pending')).toBe('Custom verification pending');
    });
  });

  describe('3. CLI table presentation vs default JSONL', () => {
    let directory: string;
    let inputPath: string;
    let stdout: string;
    let stderr: string;

    const dummyProcessor: MessageProcessor = {
      async process(msg) {
        if (msg.id === 'msg-single') {
          return {
            message_id: 'msg-single',
            classification: 'listing',
            detected_classes: ['listing'],
            listings: [
              {
                id: 'listing-001-01',
                purpose: 'sale',
                property_type: 'villa',
                city: 'Riyadh',
                district: 'Al Malqa',
                bedrooms: 4,
                bathrooms: 5,
                area_sqm: 350,
                price: { amount: 2500000, currency: 'SAR', period: 'total' },
                contact_phone: '+966551234567',
                needs_review: true,
                review_reasons: ['bedrooms_unsupported', 'price_conflict'],
                duplicate_of: null,
              },
            ],
          };
        }
        if (msg.id === 'msg-zero-offers') {
          return {
            message_id: 'msg-zero-offers',
            classification: 'buyer_request',
            detected_classes: ['buyer_request'],
            listings: [],
          };
        }
        return {
          message_id: msg.id,
          classification: 'listing',
          detected_classes: ['listing'],
          listings: [],
        };
      },
    };

    beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'table-cli-test-'));
      inputPath = join(directory, 'test.jsonl');
      stdout = '';
      stderr = '';
    });

    afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
    });

    const deps = () => ({
      createContext: async () => ({
        getProcessor: () => dummyProcessor,
        close: async () => {},
      }),
      stdout: (s: string) => { stdout += s; },
      stderr: (s: string) => { stderr += s; },
    });

    it('displays human-readable labels in --format=table output', async () => {
      const record = {
        id: 'msg-single',
        sender: '+966551234567',
        received_at: '2026-11-01T10:00:00+03:00',
        text: 'Villa in Riyadh for sale',
      };
      await writeFile(inputPath, JSON.stringify(record) + '\n');

      const exitCode = await runCli(['process', inputPath, '--format=table'], deps());
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Message ID');
      expect(stdout).toContain('Review Status');
      expect(stdout).toContain('Review Reasons');
      expect(stdout).toContain('Needs Review');
      expect(stdout).toContain('Bedroom count is missing or unreliable; Conflicting asking prices');
    });

    it('represents zero-offer messages without inventing listings in --format=table output', async () => {
      const record = {
        id: 'msg-zero-offers',
        sender: '+966551234567',
        received_at: '2026-11-01T10:00:00+03:00',
        text: 'Looking for a 2BR apartment in Olaya',
      };
      await writeFile(inputPath, JSON.stringify(record) + '\n');

      const exitCode = await runCli(['process', inputPath, '--format=table'], deps());
      expect(exitCode).toBe(0);
      expect(stdout).toContain('msg-zero-offers');
      expect(stdout).toContain('buyer_request');
      expect(stdout).toMatch(/msg-zero-offers\s+\|\s+buyer_request\s+\|\s+-\s+\|\s+-/);
    });

    it('keeps default JSONL output unchanged and contract-compliant', async () => {
      const record = {
        id: 'msg-single',
        sender: '+966551234567',
        received_at: '2026-11-01T10:00:00+03:00',
        text: 'Villa in Riyadh for sale',
      };
      await writeFile(inputPath, JSON.stringify(record) + '\n');

      const exitCode = await runCli(['process', inputPath], deps());
      expect(exitCode).toBe(0);
      const lines = stdout.trim().split('\n');
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.message_id).toBe('msg-single');
      expect(parsed.listings[0].review_reasons).toEqual(['bedrooms_unsupported', 'price_conflict']);
    });
  });

  describe('4. Stage 2 Validation Fixes (Additional Scope)', () => {
    it('semantic finding evidence association: rejects finding when quote is clipped in current offer and unclipped in another offer', () => {
      // Source text has 2 offers:
      // Offer 1: "Offer1: 5000000SAR" (where "5000000" is clipped as part of "5000000SAR")
      // Offer 2: "Offer2: 5000000 SAR" (where "5000000" is unclipped)
      const source = 'Offer1: 5000000SAR. Offer2: 5000000 SAR.';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: 'Offer1: 5000000SAR.',
            candidates: [],
            findings: [
              {
                category: 'uncertainty',
                field: 'price',
                quote: '5000000',
                description: 'Uncertain price',
              },
            ],
          },
          {
            offer_quote: 'Offer2: 5000000 SAR.',
            candidates: [],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(source, payload);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const offer1 = outcome.offers[0];
      // In Offer 1, the finding quote '5000000' is clipped in Offer 1.
      // The only unclipped occurrence is in Offer 2.
      // Therefore, Offer 1 must reject the finding with wrong_offer because only unclipped occurrences count.
      expect(offer1.rejectedFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason: 'wrong_offer',
            quote: '5000000',
          }),
        ]),
      );
      expect(offer1.semanticFindings).toHaveLength(0);
    });

    it('schema error classification: classifies candidate schema failure as invalid_schema without inspecting error message strings', () => {
      const source = 'Villa for sale in Riyadh.';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: source,
            candidates: [
              // Candidate with malformed structure: missing scope, invalid property_type value
              { field: 'property_type', value: 'castle', quote: 'Villa' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(source, payload);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const offer = outcome.offers[0];
      expect(offer.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'property_type',
            reason: 'invalid_schema',
          }),
        ]),
      );
    });

    it('documents and verifies shared-evidence limitation: mechanically verifies existence and unclipped boundaries without semantic co-reference parsing', () => {
      // Shared contact phone exists in shared header
      const source = 'Contact: +966551234567. Offer 1: Villa. Offer 2: Apartment.';
      const payload = {
        classification: 'listing',
        detected_classes: ['listing'],
        listings: [
          {
            offer_quote: 'Offer 1: Villa.',
            candidates: [
              { field: 'contact_phone', value: '+966551234567', quote: '+966551234567', scope: 'shared' },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(source, payload);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const offer = outcome.offers[0];
      expect(offer.acceptedCandidates).toHaveLength(1);
      expect(offer.acceptedCandidates[0].field).toBe('contact_phone');
    });
  });
});
