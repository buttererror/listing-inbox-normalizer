import { z } from 'zod';
import { LlmGateway } from '../llm-gateway/llm-request';
import { ProcessingFailure } from '../messages/message-result.schema';
import { RawMessage } from '../messages/raw-message.schema';
import { ExtractionResult, extractionResultSchema } from './extraction-result.schema';

const instructions = [
  'Identify one property offered for sale in the source message.',
  'Return classification listing and one candidate with assertions containing a field name and an exact quote from the source.',
  'Use field names purpose, property_type, city, district, bedrooms, bathrooms, area_sqm, price, and contact_phone.',
  'Preserve distinct assertions and their qualifiers. Do not invent facts or quotes.',
  'If the message is not a single sale listing, do not invent a listing.',
].join(' ');

export type ExtractionOutcome =
  | { ok: true; result: ExtractionResult }
  | { ok: false; failure: ProcessingFailure };

export class ExtractionService {
  constructor(private readonly gateway: LlmGateway) {}

  async extract(message: RawMessage): Promise<ExtractionOutcome> {
    const output = await this.gateway.execute({
      instructions,
      sourceText: message.text,
      responseSchema: z.toJSONSchema(extractionResultSchema, { target: 'draft-7' }),
    });
    const parsed = extractionResultSchema.safeParse(output);
    if (!parsed.success) {
      return {
        ok: false,
        failure: {
          message_id: message.id,
          error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
        },
      };
    }
    return { ok: true, result: parsed.data };
  }
}
