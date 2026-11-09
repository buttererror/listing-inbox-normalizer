import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LLM_GATEWAY, ProviderError } from '../llm-gateway/llm-request';
import type { LlmGateway } from '../llm-gateway/llm-request';
import { ProcessingFailure } from '../messages/message-result.schema';
import { RawMessage } from '../messages/raw-message.schema';
import {
  ExtractionResult,
  gatewayExtractionResponseSchema,
  gatewayWireResponseSchema,
} from './extraction-result.schema';
import {
  RejectedEvidence,
  RejectedReason,
  verifySourceIntegrity,
} from './verify-source-integrity';

export type { RejectedEvidence, RejectedReason };

const instructions = [
  'Identify one property offered for sale in the source message.',
  'Return classification listing and one candidate with assertions.',
  'Use field names purpose, property_type, city, district, bedrooms, bathrooms, area_sqm, price, and contact_phone.',
  'For each assertion, provide field, quote, verdict (supported, contradicted, or uncertain), and optionally a verbatim context_quote when surrounding text is needed to explain the verdict.',
  'Quote the shortest contiguous passage that contains the value and its essential qualifiers (including units, currency, price period, and negation), then assess it against the original message.',
  'The claimed value must appear in the quote.',
  'A deposit or recurring amount does not support a total sale price.',
  'If the same quote appears with different meanings, provide a more specific quote that distinguishes the intended occurrence; if unable to do so, return uncertain.',
  'Preserve separate assertions for competing facts. Do not invent facts or quotes.',
  'If the message is not a single sale listing, do not invent a listing.',
].join(' ');

export type ExtractionOutcome =
  | { ok: true; result: ExtractionResult; rejectedEvidence: RejectedEvidence[] }
  | { ok: false; failure: ProcessingFailure };

@Injectable()
export class ExtractionService {
  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  async extract(message: RawMessage): Promise<ExtractionOutcome> {
    let output: unknown;
    try {
      output = await this.gateway.execute({
        instructions,
        sourceText: message.text,
        responseSchema: z.toJSONSchema(gatewayWireResponseSchema, { target: 'draft-7' }),
      });
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        return {
          ok: false,
          failure: {
            message_id: message.id,
            error: { code: err.code, message: err.message },
          },
        };
      }
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const code = (err as { code: unknown }).code;
        if (code === 'provider_unavailable' || code === 'provider_timeout') {
          return {
            ok: false,
            failure: {
              message_id: message.id,
              error: {
                code,
                message: (err as { message?: string }).message ?? 'Provider error',
              },
            },
          };
        }
      }
      throw err;
    }
    const parsed = gatewayExtractionResponseSchema.safeParse(output);
    if (!parsed.success) {
      return {
        ok: false,
        failure: {
          message_id: message.id,
          error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
        },
      };
    }

    const { accepted, rejectedEvidence } = verifySourceIntegrity(
      message.text,
      parsed.data.candidates[0].assertions,
    );

    return {
      ok: true,
      result: {
        classification: parsed.data.classification,
        candidates: [{ assertions: accepted }],
      },
      rejectedEvidence,
    };
  }
}
