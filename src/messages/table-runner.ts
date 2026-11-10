import { formatReviewReason } from '../listings/review-labels';
import { MessageProcessor } from './message-processor';
import { messageSuccessSchema, processingFailureSchema } from './message-result.schema';
import { rawMessageSchema } from './raw-message.schema';

export interface TableRow {
  messageId: string;
  classification: string;
  propertyType: string;
  city: string;
  price: string;
  reviewStatus: string;
  reviewReasons: string;
}

export function formatTableOutput(rows: TableRow[]): string {
  const headers = [
    'Message ID',
    'Classification',
    'Property Type',
    'City',
    'Price',
    'Review Status',
    'Review Reasons',
  ];

  const colWidths = headers.map((h, i) => {
    const rowValues = rows.map((r) => {
      switch (i) {
        case 0:
          return r.messageId;
        case 1:
          return r.classification;
        case 2:
          return r.propertyType;
        case 3:
          return r.city;
        case 4:
          return r.price;
        case 5:
          return r.reviewStatus;
        case 6:
          return r.reviewReasons;
        default:
          return '';
      }
    });
    return Math.max(h.length, ...rowValues.map((v) => v.length));
  });

  const formatLine = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(colWidths[i])).join(' | ');

  const separator = colWidths.map((w) => '-'.repeat(w)).join('-+-');

  const lines = [
    formatLine(headers),
    separator,
    ...rows.map((r) =>
      formatLine([
        r.messageId,
        r.classification,
        r.propertyType,
        r.city,
        r.price,
        r.reviewStatus,
        r.reviewReasons,
      ]),
    ),
  ];

  return lines.join('\n') + '\n';
}

/**
 * Reads a JSONL input and writes an aligned text table where review reasons
 * are formatted using readable business labels.
 */
export async function runTable(
  input: string,
  processor: MessageProcessor,
  writeOutput: (output: string) => void,
): Promise<0 | 1> {
  let failed = false;
  const rows: TableRow[] = [];

  for (const line of input.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      failed = true;
      rows.push({
        messageId: '-',
        classification: 'ERROR',
        propertyType: '-',
        city: '-',
        price: '-',
        reviewStatus: '-',
        reviewReasons: 'Invalid JSONL record',
      });
      continue;
    }

    const validated = rawMessageSchema.safeParse(parsed);
    if (!validated.success) {
      failed = true;
      const id =
        typeof parsed === 'object' && parsed !== null && 'id' in parsed && typeof (parsed as any).id === 'string'
          ? (parsed as any).id
          : '-';
      rows.push({
        messageId: id,
        classification: 'ERROR',
        propertyType: '-',
        city: '-',
        price: '-',
        reviewStatus: '-',
        reviewReasons: 'Invalid message',
      });
      continue;
    }

    try {
      const result = await processor.process(validated.data);
      if (processingFailureSchema.safeParse(result).success) {
        failed = true;
        const failure = result as any;
        rows.push({
          messageId: failure.message_id ?? '-',
          classification: 'ERROR',
          propertyType: '-',
          city: '-',
          price: '-',
          reviewStatus: '-',
          reviewReasons: failure.error?.message ?? 'Processing error',
        });
      } else {
        const success = messageSuccessSchema.parse(result);
        if (success.listings.length === 0) {
          // Zero-offer message: represent without inventing listings
          rows.push({
            messageId: success.message_id,
            classification: success.classification,
            propertyType: '-',
            city: '-',
            price: '-',
            reviewStatus: '-',
            reviewReasons: '-',
          });
        } else {
          // One row per property offer
          for (const listing of success.listings) {
            const priceStr =
              listing.price.amount !== null
                ? `${listing.price.amount.toLocaleString()} SAR${listing.price.period ? ` (${listing.price.period})` : ''}`
                : '-';
            const statusStr = listing.needs_review ? 'Needs Review' : 'Approved';
            const reasonsStr =
              listing.review_reasons.length > 0
                ? listing.review_reasons.map(formatReviewReason).join('; ')
                : '-';

            rows.push({
              messageId: success.message_id,
              classification: success.classification,
              propertyType: listing.property_type ?? '-',
              city: listing.city ?? '-',
              price: priceStr,
              reviewStatus: statusStr,
              reviewReasons: reasonsStr,
            });
          }
        }
      }
    } catch {
      failed = true;
      rows.push({
        messageId: validated.data.id,
        classification: 'ERROR',
        propertyType: '-',
        city: '-',
        price: '-',
        reviewStatus: '-',
        reviewReasons: 'Message processing failed',
      });
    }
  }

  writeOutput(formatTableOutput(rows));
  return failed ? 1 : 0;
}
