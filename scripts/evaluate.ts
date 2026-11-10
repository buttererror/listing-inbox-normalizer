import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface MetricScore {
  numerator: number;
  denominator: number;
  percentage: number;
  formatted: string;
}

export function formatMetric(numerator: number, denominator: number): MetricScore {
  const percentage = denominator > 0 ? (numerator / denominator) * 100 : 0;
  return {
    numerator,
    denominator,
    percentage: Math.round(percentage * 10) / 10,
    formatted: `${numerator}/${denominator} (${percentage.toFixed(1)}%)`,
  };
}

export interface ExpectedListing {
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

export interface ExpectedCase {
  message_id: string;
  language: 'arabic' | 'english' | 'mixed';
  scenario: string;
  classification: string;
  detected_classes: string[];
  offer_count: number;
  listings: ExpectedListing[];
}

export interface ExpectedDataset {
  version: string;
  created_at?: string;
  description?: string;
  language_distribution?: Record<string, number>;
  cases: ExpectedCase[];
}

export interface ActualListing {
  id?: string;
  purpose: 'sale' | 'rent' | null;
  property_type: string | null;
  city: string | null;
  district: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  price: {
    amount: number | null;
    currency: string;
    period: 'total' | 'yearly' | 'monthly' | null;
  };
  contact_phone: string | null;
  needs_review: boolean;
  review_reasons: string[];
  duplicate_of?: string | null;
}

export interface ActualSuccess {
  message_id: string;
  classification: string;
  detected_classes: string[];
  listings: ActualListing[];
}

export interface ActualFailure {
  message_id: string | null;
  error: {
    code: string;
    message: string;
  };
}

export type ActualResult = ActualSuccess | ActualFailure;

export interface MismatchDetail {
  message_id: string;
  type:
    | 'classification'
    | 'detected_classes'
    | 'offer_count'
    | 'field'
    | 'review_decision'
    | 'review_reasons'
    | 'provider_failure'
    | 'missing_result'
    | 'malformed_line'
    | 'extra_offer'
    | 'missing_offer';
  description: string;
  expected?: any;
  actual?: any;
  offer_index?: number;
  field?: string;
}

export interface EvaluationMetrics {
  classification_accuracy: MetricScore;
  detected_class_accuracy: MetricScore;
  offer_count_accuracy: MetricScore;
  field_accuracy: MetricScore;
  unsupported_value_acceptance: MetricScore;
  supported_value_omission: MetricScore;
  review_precision: MetricScore;
  review_recall: MetricScore;
}

export interface FieldMetric {
  total_comparisons: number;
  correct: number;
  accuracy_percentage: number;
  unsupported_accepted: number;
  supported_omitted: number;
}

export interface EvaluationSummary {
  version: string;
  timestamp: string;
  total_cases: number;
  scored_cases: number;
  provider_failures: number;
  malformed_lines: number;
  missing_results: number;
  metrics: EvaluationMetrics;
  offer_matching: {
    expected_offers: number;
    actual_offers: number;
    matched_offers: number;
    extra_offers: number;
    missing_offers: number;
  };
  field_breakdown: Record<string, FieldMetric>;
  review_breakdown: {
    true_positives: number;
    false_positives: number;
    false_negatives: number;
    true_negatives: number;
  };
  mismatches: MismatchDetail[];
  excluded_from_denominators: string[];
}

export interface TelemetryRecord {
  message_id?: string;
  provider: string;
  model: string;
  duration_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  error_code?: string;
}

const TELEMETRY_PREFIX = 'DWELLEO_TELEMETRY ';

export function parseTelemetry(stderr: string): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    if (!line.startsWith(TELEMETRY_PREFIX)) continue;
    try {
      const value: unknown = JSON.parse(line.slice(TELEMETRY_PREFIX.length));
      if (typeof value === 'object' && value !== null &&
        typeof (value as TelemetryRecord).provider === 'string' &&
        typeof (value as TelemetryRecord).model === 'string' &&
        typeof (value as TelemetryRecord).duration_ms === 'number') {
        records.push(value as TelemetryRecord);
      }
    } catch { /* Ignore malformed telemetry diagnostics. */ }
  }
  return records;
}

export const EVALUATED_FIELDS = [
  'purpose',
  'property_type',
  'city',
  'district',
  'bedrooms',
  'bathrooms',
  'area_sqm',
  'price.amount',
  'price.period',
  'price.currency',
  'contact_phone',
] as const;

export type EvaluatedField = (typeof EVALUATED_FIELDS)[number];

function getFieldValue(listing: ActualListing | ExpectedListing, field: EvaluatedField): any {
  switch (field) {
    case 'purpose':
      return listing.purpose;
    case 'property_type':
      return listing.property_type;
    case 'city':
      return listing.city;
    case 'district':
      return listing.district;
    case 'bedrooms':
      return listing.bedrooms;
    case 'bathrooms':
      return listing.bathrooms;
    case 'area_sqm':
      return listing.area_sqm;
    case 'price.amount':
      return listing.price?.amount ?? null;
    case 'price.period':
      return listing.price?.period ?? null;
    case 'price.currency':
      return listing.price?.currency ?? null;
    case 'contact_phone':
      return listing.contact_phone;
  }
}

function normalizeString(value: any): any {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

function valuesEqual(actualVal: any, expectedVal: any): boolean {
  if (actualVal === null && expectedVal === null) return true;
  if (actualVal === null || expectedVal === null) return false;
  return normalizeString(actualVal) === normalizeString(expectedVal);
}

function isFieldApplicable(field: EvaluatedField, expectedListing: ExpectedListing): boolean {
  const baseField = field.startsWith('price.') ? 'price' : field;
  if (expectedListing.inapplicable_fields.includes(baseField)) {
    return false;
  }
  return true;
}

/**
 * Pure evaluation function that scores parsed actual JSON lines against the expected dataset.
 */
export function evaluateResults(
  actualLines: string[],
  expectedDataset: ExpectedDataset,
): EvaluationSummary {
  const timestamp = new Date().toISOString();
  const mismatches: MismatchDetail[] = [];
  const excludedFromDenominators: string[] = [];

  // Parse actual lines by message_id
  const actualByMessageId = new Map<string, ActualResult>();
  const malformedLines: string[] = [];

  for (let idx = 0; idx < actualLines.length; idx++) {
    const rawLine = actualLines[idx].trim();
    if (rawLine.length === 0) continue;

    try {
      const parsed = JSON.parse(rawLine);
      if (typeof parsed !== 'object' || parsed === null) {
        malformedLines.push(rawLine);
        continue;
      }
      if (parsed.message_id) {
        actualByMessageId.set(parsed.message_id, parsed);
      } else if (parsed.error) {
        // Line without message_id but with error
        malformedLines.push(rawLine);
      }
    } catch {
      malformedLines.push(rawLine);
    }
  }

  let providerFailuresCount = 0;
  let missingResultsCount = 0;
  let scoredCasesCount = 0;

  let correctClassificationCount = 0;
  let correctDetectedClassesCount = 0;
  let correctOfferCountCount = 0;

  let totalApplicableFieldComparisons = 0;
  let correctApplicableFieldComparisons = 0;

  let totalExpectedNullOpportunities = 0;
  let unsupportedValueAcceptedCount = 0;

  let totalExpectedSupportedOpportunities = 0;
  let supportedValueOmittedCount = 0;

  let reviewTruePositives = 0;
  let reviewFalsePositives = 0;
  let reviewFalseNegatives = 0;
  let reviewTrueNegatives = 0;

  let totalExpectedOffers = 0;
  let totalActualOffers = 0;
  let matchedOffersCount = 0;
  let extraOffersCount = 0;
  let missingOffersCount = 0;

  const fieldStats: Record<string, { total: number; correct: number; unsupported: number; omitted: number }> = {};
  for (const field of EVALUATED_FIELDS) {
    fieldStats[field] = { total: 0, correct: 0, unsupported: 0, omitted: 0 };
  }

  // Iterate over expected cases
  for (const expectedCase of expectedDataset.cases) {
    const messageId = expectedCase.message_id;
    totalExpectedOffers += expectedCase.offer_count;

    const actualResult = actualByMessageId.get(messageId);

    if (!actualResult) {
      missingResultsCount++;
      excludedFromDenominators.push(messageId);
      mismatches.push({
        message_id: messageId,
        type: 'missing_result',
        description: `No CLI result found for message ${messageId}`,
      });
      continue;
    }

    // Check for provider failure
    if ('error' in actualResult && actualResult.error) {
      providerFailuresCount++;
      excludedFromDenominators.push(messageId);
      mismatches.push({
        message_id: messageId,
        type: 'provider_failure',
        description: `Provider error ${actualResult.error.code}: ${actualResult.error.message}`,
        actual: actualResult.error,
      });
      continue;
    }

    // Valid success result to score
    scoredCasesCount++;
    const actualSuccess = actualResult as ActualSuccess;
    const actualListings = actualSuccess.listings || [];
    totalActualOffers += actualListings.length;

    // 1. Classification
    if (actualSuccess.classification === expectedCase.classification) {
      correctClassificationCount++;
    } else {
      mismatches.push({
        message_id: messageId,
        type: 'classification',
        description: `Classification mismatch: expected "${expectedCase.classification}", received "${actualSuccess.classification}"`,
        expected: expectedCase.classification,
        actual: actualSuccess.classification,
      });
    }

    // 2. Detected classes (order-sensitive array equality)
    const expectedClasses = expectedCase.detected_classes || [];
    const actualClasses = actualSuccess.detected_classes || [];
    const classesMatch =
      expectedClasses.length === actualClasses.length &&
      expectedClasses.every((val, i) => val === actualClasses[i]);

    if (classesMatch) {
      correctDetectedClassesCount++;
    } else {
      mismatches.push({
        message_id: messageId,
        type: 'detected_classes',
        description: `Detected classes mismatch: expected [${expectedClasses.join(', ')}], received [${actualClasses.join(', ')}]`,
        expected: expectedClasses,
        actual: actualClasses,
      });
    }

    // 3. Offer count
    if (actualListings.length === expectedCase.offer_count) {
      correctOfferCountCount++;
    } else {
      mismatches.push({
        message_id: messageId,
        type: 'offer_count',
        description: `Offer count mismatch: expected ${expectedCase.offer_count}, received ${actualListings.length}`,
        expected: expectedCase.offer_count,
        actual: actualListings.length,
      });
    }

    // 4. Offer Matching and Field Comparisons
    const expCount = expectedCase.listings.length;
    const actCount = actualListings.length;
    const matchCount = Math.min(expCount, actCount);

    matchedOffersCount += matchCount;

    // Report extra offers
    if (actCount > expCount) {
      const extra = actCount - expCount;
      extraOffersCount += extra;
      for (let extraIdx = expCount; extraIdx < actCount; extraIdx++) {
        mismatches.push({
          message_id: messageId,
          type: 'extra_offer',
          offer_index: extraIdx,
          description: `Unexpected extra offer extracted at index ${extraIdx}`,
          actual: actualListings[extraIdx],
        });
        // Any populated value in an extra offer is an unsupported value accepted
        for (const field of EVALUATED_FIELDS) {
          const val = getFieldValue(actualListings[extraIdx], field);
          if (val !== null) {
            unsupportedValueAcceptedCount++;
            fieldStats[field].unsupported++;
          }
        }
      }
    }

    // Report missing offers
    if (expCount > actCount) {
      const missing = expCount - actCount;
      missingOffersCount += missing;
      for (let missingIdx = actCount; missingIdx < expCount; missingIdx++) {
        mismatches.push({
          message_id: messageId,
          type: 'missing_offer',
          offer_index: missingIdx,
          description: `Expected offer at index ${missingIdx} was not extracted`,
          expected: expectedCase.listings[missingIdx],
        });
        // Any supported value in a missing offer is a supported value omitted
        for (const field of EVALUATED_FIELDS) {
          const val = getFieldValue(expectedCase.listings[missingIdx], field);
          if (val !== null) {
            supportedValueOmittedCount++;
            totalExpectedSupportedOpportunities++;
            fieldStats[field].omitted++;
          }
        }
      }
    }

    // Compare matched offers
    for (let oIdx = 0; oIdx < matchCount; oIdx++) {
      const expListing = expectedCase.listings[oIdx];
      const actListing = actualListings[oIdx];

      // Review decision metrics
      const expReview = Boolean(expListing.needs_review);
      const actReview = Boolean(actListing.needs_review);

      if (expReview && actReview) {
        reviewTruePositives++;
      } else if (!expReview && actReview) {
        reviewFalsePositives++;
        mismatches.push({
          message_id: messageId,
          type: 'review_decision',
          offer_index: oIdx,
          description: `False positive review flag: listing was flagged for review when expected clean`,
          expected: expListing.review_reasons,
          actual: actListing.review_reasons,
        });
      } else if (expReview && !actReview) {
        reviewFalseNegatives++;
        mismatches.push({
          message_id: messageId,
          type: 'review_decision',
          offer_index: oIdx,
          description: `False negative review flag: listing was not flagged for review when review was required`,
          expected: expListing.review_reasons,
          actual: actListing.review_reasons,
        });
      } else {
        reviewTrueNegatives++;
      }

      // Check review reasons set equality if both flagged
      if (expReview && actReview) {
        const expReasons = new Set(expListing.review_reasons);
        const actReasons = new Set(actListing.review_reasons);
        const diffExp = [...expReasons].filter((r) => !actReasons.has(r));
        const diffAct = [...actReasons].filter((r) => !expReasons.has(r));

        if (diffExp.length > 0 || diffAct.length > 0) {
          mismatches.push({
            message_id: messageId,
            type: 'review_reasons',
            offer_index: oIdx,
            description: `Review reasons mismatch: missing [${diffExp.join(', ')}], unexpected [${diffAct.join(', ')}]`,
            expected: expListing.review_reasons,
            actual: actListing.review_reasons,
          });
        }
      }

      // Field-level comparison
      for (const field of EVALUATED_FIELDS) {
        const expVal = getFieldValue(expListing, field);
        const actVal = getFieldValue(actListing, field);
        const applicable = isFieldApplicable(field, expListing);

        // Track unsupported value acceptance:
        // Opportunities where expected is null
        if (expVal === null) {
          totalExpectedNullOpportunities++;
          if (actVal !== null) {
            unsupportedValueAcceptedCount++;
            fieldStats[field].unsupported++;
            mismatches.push({
              message_id: messageId,
              type: 'field',
              offer_index: oIdx,
              field,
              description: `Unsupported value accepted: field "${field}" expected null, received ${JSON.stringify(actVal)}`,
              expected: null,
              actual: actVal,
            });
          }
        } else {
          // Opportunities where expected is not null
          totalExpectedSupportedOpportunities++;
          if (actVal === null) {
            supportedValueOmittedCount++;
            fieldStats[field].omitted++;
            mismatches.push({
              message_id: messageId,
              type: 'field',
              offer_index: oIdx,
              field,
              description: `Supported value omitted: field "${field}" expected ${JSON.stringify(expVal)}, received null`,
              expected: expVal,
              actual: null,
            });
          }
        }

        // Field accuracy (scored on applicable fields only)
        if (applicable) {
          totalApplicableFieldComparisons++;
          fieldStats[field].total++;

          if (valuesEqual(actVal, expVal)) {
            correctApplicableFieldComparisons++;
            fieldStats[field].correct++;
          } else {
            // Only add mismatch if not already recorded above
            if (expVal !== null && actVal !== null) {
              mismatches.push({
                message_id: messageId,
                type: 'field',
                offer_index: oIdx,
                field,
                description: `Field "${field}" value mismatch: expected ${JSON.stringify(expVal)}, received ${JSON.stringify(actVal)}`,
                expected: expVal,
                actual: actVal,
              });
            }
          }
        }
      }
    }
  }

  // Calculate review precision and recall
  const precisionDenominator = reviewTruePositives + reviewFalsePositives;
  const recallDenominator = reviewTruePositives + reviewFalseNegatives;

  const fieldBreakdown: Record<string, FieldMetric> = {};
  for (const field of EVALUATED_FIELDS) {
    const st = fieldStats[field];
    fieldBreakdown[field] = {
      total_comparisons: st.total,
      correct: st.correct,
      accuracy_percentage: st.total > 0 ? Math.round((st.correct / st.total) * 1000) / 10 : 100,
      unsupported_accepted: st.unsupported,
      supported_omitted: st.omitted,
    };
  }

  return {
    version: expectedDataset.version || '1.0.0',
    timestamp,
    total_cases: expectedDataset.cases.length,
    scored_cases: scoredCasesCount,
    provider_failures: providerFailuresCount,
    malformed_lines: malformedLines.length,
    missing_results: missingResultsCount,
    metrics: {
      classification_accuracy: formatMetric(correctClassificationCount, scoredCasesCount),
      detected_class_accuracy: formatMetric(correctDetectedClassesCount, scoredCasesCount),
      offer_count_accuracy: formatMetric(correctOfferCountCount, scoredCasesCount),
      field_accuracy: formatMetric(correctApplicableFieldComparisons, totalApplicableFieldComparisons),
      unsupported_value_acceptance: formatMetric(unsupportedValueAcceptedCount, totalExpectedNullOpportunities),
      supported_value_omission: formatMetric(supportedValueOmittedCount, totalExpectedSupportedOpportunities),
      review_precision: formatMetric(reviewTruePositives, precisionDenominator),
      review_recall: formatMetric(reviewTruePositives, recallDenominator),
    },
    offer_matching: {
      expected_offers: totalExpectedOffers,
      actual_offers: totalActualOffers,
      matched_offers: matchedOffersCount,
      extra_offers: extraOffersCount,
      missing_offers: missingOffersCount,
    },
    field_breakdown: fieldBreakdown,
    review_breakdown: {
      true_positives: reviewTruePositives,
      false_positives: reviewFalsePositives,
      false_negatives: reviewFalseNegatives,
      true_negatives: reviewTrueNegatives,
    },
    mismatches,
    excluded_from_denominators: excludedFromDenominators,
  };
}

export interface EvaluateCliOptions {
  casesPath?: string;
  expectedPath?: string;
  actualPath?: string;
  outputDir?: string;
  cliPath?: string;
}

/**
 * Runs evaluation end-to-end: invokes CLI if actualPath is omitted, parses output,
 * scores against expected, writes results and summary, and prints console report.
 */
export async function runEvaluation(options: EvaluateCliOptions = {}): Promise<EvaluationSummary> {
  const rootDir = process.cwd();
  const casesPath = path.resolve(rootDir, options.casesPath || 'test/evaluation/cases.jsonl');
  const expectedPath = path.resolve(rootDir, options.expectedPath || 'test/evaluation/expected.json');
  const outputDir = path.resolve(rootDir, options.outputDir || 'evaluation-results');
  const cliPath = path.resolve(rootDir, options.cliPath || 'dist/cli.js');

  if (!fs.existsSync(expectedPath)) {
    throw new Error(`Expected dataset not found at ${expectedPath}`);
  }
  const expectedData: ExpectedDataset = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));

  fs.mkdirSync(outputDir, { recursive: true });

  let actualLines: string[] = [];

  if (options.actualPath) {
    const resolvedActual = path.resolve(rootDir, options.actualPath);
    if (!fs.existsSync(resolvedActual)) {
      throw new Error(`Actual results file not found at ${resolvedActual}`);
    }
    actualLines = fs.readFileSync(resolvedActual, 'utf-8').split('\n');
  } else {
    if (!fs.existsSync(casesPath)) {
      throw new Error(`Cases file not found at ${casesPath}`);
    }
    if (!fs.existsSync(cliPath)) {
      throw new Error(`CLI not found at ${cliPath}. Run 'pnpm run build' first.`);
    }

    console.log(`Executing CLI: node ${cliPath} process ${casesPath}`);
    const res = spawnSync('node', [cliPath, 'process', casesPath], {
      cwd: rootDir,
      encoding: 'utf-8',
      env: { ...process.env, DWELLEO_TELEMETRY: '1' },
    });

    const rawStdout = res.stdout || '';
    actualLines = rawStdout.split('\n');

    // Save captured output
    const actualOutputPath = path.join(outputDir, 'actual.jsonl');
    fs.writeFileSync(actualOutputPath, rawStdout, 'utf-8');
    console.log(`Saved raw CLI results to ${actualOutputPath}`);

    const telemetry = parseTelemetry(res.stderr || '');
    const telemetryPath = path.join(outputDir, 'telemetry.jsonl');
    fs.writeFileSync(telemetryPath, telemetry.map((record) => JSON.stringify(record)).join('\n') + (telemetry.length ? '\n' : ''), 'utf-8');
    console.log(`Saved ${telemetry.length} per-message telemetry records to ${telemetryPath}`);

    if (res.status !== 0 && res.status !== 1) {
      console.warn(`CLI process exited with non-standard code ${res.status}`);
      if (res.stderr) console.error(res.stderr.split(/\r?\n/).filter((line) => !line.startsWith(TELEMETRY_PREFIX)).join('\n'));
    }
  }

  const summary = evaluateResults(actualLines, expectedData);

  const summaryOutputPath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(summaryOutputPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`Saved evaluation summary to ${summaryOutputPath}`);

  printConsoleReport(summary);

  return summary;
}

export function printConsoleReport(summary: EvaluationSummary): void {
  const m = summary.metrics;
  console.log('\n======================================================');
  console.log(` DWELLEO EVALUATION REPORT — Dataset v${summary.version}`);
  console.log(` Run Date: ${summary.timestamp}`);
  console.log('======================================================');
  console.log(`Total Cases:       ${summary.total_cases}`);
  console.log(`Scored Cases:      ${summary.scored_cases}`);
  console.log(`Provider Failures: ${summary.provider_failures}`);
  console.log(`Malformed Lines:   ${summary.malformed_lines}`);
  console.log(`Missing Results:   ${summary.missing_results}`);
  if (summary.excluded_from_denominators.length > 0) {
    console.log(`Excluded IDs:      ${summary.excluded_from_denominators.join(', ')}`);
  }
  console.log('------------------------------------------------------');
  console.log(' PRIMARY METRICS');
  console.log('------------------------------------------------------');
  console.log(`1. Classification Accuracy:         ${m.classification_accuracy.formatted}`);
  console.log(`2. Detected-Class Accuracy:         ${m.detected_class_accuracy.formatted}`);
  console.log(`3. Offer-Count Accuracy:            ${m.offer_count_accuracy.formatted}`);
  console.log(`4. Field Accuracy (Applicable):     ${m.field_accuracy.formatted}`);
  console.log(`5. Unsupported-Value Acceptance:    ${m.unsupported_value_acceptance.formatted}`);
  console.log(`6. Supported-Value Omission:        ${m.supported_value_omission.formatted}`);
  console.log(`7. Review Precision:                ${m.review_precision.formatted}`);
  console.log(`8. Review Recall:                   ${m.review_recall.formatted}`);
  console.log('------------------------------------------------------');
  console.log(' OFFER & REVIEW BREAKDOWNS');
  console.log('------------------------------------------------------');
  console.log(
    `Offers:  Expected=${summary.offer_matching.expected_offers} | Actual=${summary.offer_matching.actual_offers} | Matched=${summary.offer_matching.matched_offers} | Extra=${summary.offer_matching.extra_offers} | Missing=${summary.offer_matching.missing_offers}`,
  );
  console.log(
    `Review:  TP=${summary.review_breakdown.true_positives} | FP=${summary.review_breakdown.false_positives} | FN=${summary.review_breakdown.false_negatives} | TN=${summary.review_breakdown.true_negatives}`,
  );
  console.log('------------------------------------------------------');
  console.log(' FIELD-BY-FIELD ACCURACY');
  console.log('------------------------------------------------------');
  for (const [field, st] of Object.entries(summary.field_breakdown)) {
    const padded = field.padEnd(16, ' ');
    console.log(
      ` ${padded} : ${st.correct}/${st.total_comparisons} (${st.accuracy_percentage.toFixed(1)}%) | Unsupp: ${st.unsupported_accepted} | Omitted: ${st.supported_omitted}`,
    );
  }
  console.log('------------------------------------------------------');
  console.log(` TOTAL MISMATCHES: ${summary.mismatches.length}`);
  console.log('------------------------------------------------------');
  if (summary.mismatches.length === 0) {
    console.log(' Zero mismatches! 100% agreement with expected labels.');
  } else {
    for (const item of summary.mismatches.slice(0, 15)) {
      const idxStr = item.offer_index !== undefined ? ` [offer #${item.offer_index}]` : '';
      console.log(` • [${item.message_id}]${idxStr} (${item.type}): ${item.description}`);
    }
    if (summary.mismatches.length > 15) {
      console.log(` ... and ${summary.mismatches.length - 15} more mismatches.`);
    }
  }
  console.log('======================================================\n');
}

// CLI entrypoint when executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: EvaluateCliOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cases' && args[i + 1]) {
      options.casesPath = args[++i];
    } else if (args[i] === '--expected' && args[i + 1]) {
      options.expectedPath = args[++i];
    } else if (args[i] === '--actual' && args[i + 1]) {
      options.actualPath = args[++i];
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (args[i] === '--cli' && args[i + 1]) {
      options.cliPath = args[++i];
    } else if (args[i] === '--help') {
      console.log(`
Usage: ts-node scripts/evaluate.ts [options]

Options:
  --cases <path>       Path to cases.jsonl (default: test/evaluation/cases.jsonl)
  --expected <path>    Path to expected.json (default: test/evaluation/expected.json)
  --actual <path>      Path to existing actual.jsonl (skips CLI invocation)
  --output-dir <path>  Directory to save actual.jsonl and summary.json (default: evaluation-results)
  --cli <path>         Path to built CLI entrypoint (default: dist/cli.js)
  --help               Show this help message
`);
      process.exit(0);
    }
  }

  runEvaluation(options).catch((err) => {
    console.error('Evaluation failed:', err);
    process.exit(1);
  });
}
