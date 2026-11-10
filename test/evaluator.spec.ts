import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  evaluateResults,
  runEvaluation,
  ExpectedDataset,
  ActualSuccess,
} from '../scripts/evaluate';

describe('Offline Evaluator (Task 03.2)', () => {
  const expectedPath = path.resolve(__dirname, 'evaluation/expected.json');
  let expectedData: ExpectedDataset;

  beforeAll(() => {
    expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
  });

  function makePerfectLines(data: ExpectedDataset): string[] {
    return data.cases.map((c) => {
      const success: ActualSuccess = {
        message_id: c.message_id,
        classification: c.classification,
        detected_classes: [...c.detected_classes],
        listings: c.listings.map((l) => ({
          id: randomUUID(), // verify random UUIDs are never used as matching keys
          purpose: l.purpose,
          property_type: l.property_type,
          city: l.city,
          district: l.district,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          area_sqm: l.area_sqm,
          price: {
            amount: l.price.amount,
            currency: l.price.currency,
            period: l.price.period,
          },
          contact_phone: l.contact_phone,
          needs_review: l.needs_review,
          review_reasons: [...l.review_reasons],
          duplicate_of: null,
        })),
      };
      return JSON.stringify(success);
    });
  }

  it('scores 100% across all metrics on fabricated perfect output with 0 mismatches', () => {
    const perfectLines = makePerfectLines(expectedData);
    const summary = evaluateResults(perfectLines, expectedData);

    expect(summary.total_cases).toBe(20);
    expect(summary.scored_cases).toBe(20);
    expect(summary.provider_failures).toBe(0);
    expect(summary.malformed_lines).toBe(0);
    expect(summary.missing_results).toBe(0);
    expect(summary.excluded_from_denominators).toEqual([]);

    expect(summary.metrics.classification_accuracy.percentage).toBe(100);
    expect(summary.metrics.classification_accuracy.numerator).toBe(20);
    expect(summary.metrics.classification_accuracy.denominator).toBe(20);

    expect(summary.metrics.detected_class_accuracy.percentage).toBe(100);
    expect(summary.metrics.detected_class_accuracy.numerator).toBe(20);

    expect(summary.metrics.offer_count_accuracy.percentage).toBe(100);
    expect(summary.metrics.offer_count_accuracy.numerator).toBe(20);

    expect(summary.metrics.field_accuracy.percentage).toBe(100);
    expect(summary.metrics.field_accuracy.numerator).toBe(summary.metrics.field_accuracy.denominator);

    expect(summary.metrics.unsupported_value_acceptance.percentage).toBe(0);
    expect(summary.metrics.unsupported_value_acceptance.numerator).toBe(0);

    expect(summary.metrics.supported_value_omission.percentage).toBe(0);
    expect(summary.metrics.supported_value_omission.numerator).toBe(0);

    expect(summary.metrics.review_precision.percentage).toBe(100);
    expect(summary.metrics.review_recall.percentage).toBe(100);

    expect(summary.offer_matching.expected_offers).toBe(16);
    expect(summary.offer_matching.actual_offers).toBe(16);
    expect(summary.offer_matching.matched_offers).toBe(16);
    expect(summary.offer_matching.extra_offers).toBe(0);
    expect(summary.offer_matching.missing_offers).toBe(0);

    expect(summary.mismatches).toEqual([]);
  });

  it('accurately identifies and reports missing and extra offers', () => {
    const lines = makePerfectLines(expectedData);

    // Modify eval-003 (expected 2 offers) to have only 1 offer (missing offer)
    const eval003Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-003');
    const eval003Obj: ActualSuccess = JSON.parse(lines[eval003Idx]);
    eval003Obj.listings = [eval003Obj.listings[0]]; // dropped offer index 1
    lines[eval003Idx] = JSON.stringify(eval003Obj);

    // Modify eval-005 (expected 0 offers) to have 1 offer (extra offer)
    const eval005Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-005');
    const eval005Obj: ActualSuccess = JSON.parse(lines[eval005Idx]);
    eval005Obj.listings = [
      {
        id: randomUUID(),
        purpose: 'sale',
        property_type: 'other',
        city: 'مكة المكرمة',
        district: 'العزيزية',
        bedrooms: null,
        bathrooms: null,
        area_sqm: null,
        price: { amount: 15000000, currency: 'SAR', period: 'total' },
        contact_phone: '+966555667788',
        needs_review: false,
        review_reasons: [],
      },
    ];
    lines[eval005Idx] = JSON.stringify(eval005Obj);

    const summary = evaluateResults(lines, expectedData);

    expect(summary.offer_matching.missing_offers).toBe(1);
    expect(summary.offer_matching.extra_offers).toBe(1);
    expect(summary.metrics.offer_count_accuracy.numerator).toBe(18); // 2 cases failed offer count

    const missingMismatch = summary.mismatches.find((m) => m.type === 'missing_offer');
    expect(missingMismatch).toBeDefined();
    expect(missingMismatch?.message_id).toBe('eval-003');

    const extraMismatch = summary.mismatches.find((m) => m.type === 'extra_offer');
    expect(extraMismatch).toBeDefined();
    expect(extraMismatch?.message_id).toBe('eval-005');
  });

  it('measures unsupported-value acceptance when expected null values are populated', () => {
    const lines = makePerfectLines(expectedData);

    // eval-004 is land with per-sqm price only, expected price.amount: null.
    // Fabricate an error where asking price is populated with 2500 (mistaking per-sqm for asking price)
    const eval004Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-004');
    const eval004Obj: ActualSuccess = JSON.parse(lines[eval004Idx]);
    eval004Obj.listings[0].price.amount = 2500;
    lines[eval004Idx] = JSON.stringify(eval004Obj);

    const summary = evaluateResults(lines, expectedData);

    expect(summary.metrics.unsupported_value_acceptance.numerator).toBeGreaterThan(0);
    const unsuppMismatch = summary.mismatches.find(
      (m) => m.type === 'field' && m.message_id === 'eval-004' && m.field === 'price.amount',
    );
    expect(unsuppMismatch).toBeDefined();
    expect(unsuppMismatch?.description).toContain('Unsupported value accepted');
    expect(summary.field_breakdown['price.amount'].unsupported_accepted).toBe(1);
  });

  it('measures supported-value omission when supported values are left null', () => {
    const lines = makePerfectLines(expectedData);

    // eval-001 has supported city "الخبر". Fabricate an error where city is dropped to null
    const eval001Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-001');
    const eval001Obj: ActualSuccess = JSON.parse(lines[eval001Idx]);
    eval001Obj.listings[0].city = null;
    lines[eval001Idx] = JSON.stringify(eval001Obj);

    const summary = evaluateResults(lines, expectedData);

    expect(summary.metrics.supported_value_omission.numerator).toBeGreaterThan(0);
    const omittedMismatch = summary.mismatches.find(
      (m) => m.type === 'field' && m.message_id === 'eval-001' && m.field === 'city',
    );
    expect(omittedMismatch).toBeDefined();
    expect(omittedMismatch?.description).toContain('Supported value omitted');
    expect(summary.field_breakdown['city'].supported_omitted).toBe(1);
  });

  it('computes review precision and recall under false positives and false negatives', () => {
    const lines = makePerfectLines(expectedData);

    // eval-001 expected needs_review: false. Set to true (False Positive)
    const eval001Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-001');
    const eval001Obj: ActualSuccess = JSON.parse(lines[eval001Idx]);
    eval001Obj.listings[0].needs_review = true;
    eval001Obj.listings[0].review_reasons = ['district_missing'];
    lines[eval001Idx] = JSON.stringify(eval001Obj);

    // eval-002 expected needs_review: true. Set to false (False Negative)
    const eval002Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-002');
    const eval002Obj: ActualSuccess = JSON.parse(lines[eval002Idx]);
    eval002Obj.listings[0].needs_review = false;
    eval002Obj.listings[0].review_reasons = [];
    lines[eval002Idx] = JSON.stringify(eval002Obj);

    const summary = evaluateResults(lines, expectedData);

    expect(summary.review_breakdown.false_positives).toBe(1);
    expect(summary.review_breakdown.false_negatives).toBe(1);
    expect(summary.metrics.review_precision.percentage).toBeLessThan(100);
    expect(summary.metrics.review_recall.percentage).toBeLessThan(100);

    const fpMismatch = summary.mismatches.find(
      (m) => m.type === 'review_decision' && m.message_id === 'eval-001',
    );
    expect(fpMismatch).toBeDefined();

    const fnMismatch = summary.mismatches.find(
      (m) => m.type === 'review_decision' && m.message_id === 'eval-002',
    );
    expect(fnMismatch).toBeDefined();
  });

  it('handles malformed JSONL lines, missing results, and provider failures safely', () => {
    const lines = makePerfectLines(expectedData);

    // Set eval-007 as a provider failure
    const eval007Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-007');
    lines[eval007Idx] = JSON.stringify({
      message_id: 'eval-007',
      error: { code: 'provider_unavailable', message: 'upstream service unreachable' },
    });

    // Remove eval-020 entirely (missing result)
    const eval020Idx = expectedData.cases.findIndex((c) => c.message_id === 'eval-020');
    lines.splice(eval020Idx, 1);

    // Append an extra malformed JSON line
    lines.push('{"broken_line": [unclosed json');

    const summary = evaluateResults(lines, expectedData);

    expect(summary.malformed_lines).toBe(1);
    expect(summary.provider_failures).toBe(1);
    expect(summary.missing_results).toBe(1);
    expect(summary.scored_cases).toBe(18);
    expect(summary.excluded_from_denominators).toContain('eval-007');
    expect(summary.excluded_from_denominators).toContain('eval-020');

    // Denominator for scored cases is 18
    expect(summary.metrics.classification_accuracy.denominator).toBe(18);
    expect(summary.metrics.classification_accuracy.numerator).toBe(18);
  });

  it('executes runEvaluation with an actual results file and generates summary.json without API key', async () => {
    const tempDir = path.resolve(__dirname, '../evaluation-results/test-run');
    fs.mkdirSync(tempDir, { recursive: true });

    const tempActualPath = path.join(tempDir, 'test-actual.jsonl');
    const perfectLines = makePerfectLines(expectedData);
    fs.writeFileSync(tempActualPath, perfectLines.join('\n'), 'utf-8');

    // Ensure no API key is required
    const summary = await runEvaluation({
      actualPath: tempActualPath,
      expectedPath,
      outputDir: tempDir,
    });

    expect(summary.scored_cases).toBe(20);
    const summaryFile = path.join(tempDir, 'summary.json');
    expect(fs.existsSync(summaryFile)).toBe(true);

    const onDiskSummary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
    expect(onDiskSummary.version).toBe(expectedData.version);
    expect(onDiskSummary.metrics.classification_accuracy.percentage).toBe(100);

    // Clean up temporary test files
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
