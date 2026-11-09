import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LLM_GATEWAY, ProviderError } from '../llm-gateway/llm-request';
import type { LlmGateway } from '../llm-gateway/llm-request';
import { ProcessingFailure } from '../messages/message-result.schema';
import { RawMessage } from '../messages/raw-message.schema';
import { DOMAIN_INSTRUCTIONS } from './domain-prompt';
import {
  ExtractedOffer,
  gatewayExtractionResponseSchema,
  Stage1ExtractionResult,
  stage1GatewayWireSchema,
  validateExtractionEnvelope,
} from './extraction-result.schema';
import {
  RejectedEvidence,
  RejectedReason,
  verifySourceIntegrity,
} from './verify-source-integrity';

export type { RejectedEvidence, RejectedReason };

export type ExtractionOutcome =
  | {
      ok: true;
      result: Stage1ExtractionResult & {
        candidates?: Array<{ assertions: Array<{ field: string; quote: string }> }>;
      };
      rejectedEvidence?: RejectedEvidence[];
    }
  | { ok: false; failure: ProcessingFailure };

@Injectable()
export class ExtractionService {
  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  async extract(message: RawMessage): Promise<ExtractionOutcome> {
    let output: unknown;
    try {
      output = await this.gateway.execute({
        instructions: DOMAIN_INSTRUCTIONS,
        sourceText: message.text,
        responseSchema: z.toJSONSchema(stage1GatewayWireSchema, { target: 'draft-7' }),
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

    // First validate Stage 1 envelope
    const envelope = validateExtractionEnvelope(output);
    if (envelope.ok) {
      const { classification, detected_classes, listings } = envelope.data;
      const legacyCandidates = listings.map((offer) => ({
        assertions: (offer.candidates as Array<{ field?: string; quote?: string }>)
          .filter((c) => typeof c?.field === 'string' && typeof c?.quote === 'string')
          .map((c) => ({ field: c.field!, quote: c.quote! })),
      }));

      return {
        ok: true,
        result: {
          classification,
          detected_classes,
          listings: listings as ExtractedOffer[],
          candidates: legacyCandidates,
        },
        rejectedEvidence: [],
      };
    }

    // Fallback: check legacy v1 candidate assertions structure
    const legacyParsed = gatewayExtractionResponseSchema.safeParse(output);
    if (legacyParsed.success) {
      const { accepted, rejectedEvidence } = verifySourceIntegrity(
        message.text,
        legacyParsed.data.candidates[0].assertions,
      );
      return {
        ok: true,
        result: {
          classification: 'listing',
          candidates: [{ assertions: accepted }],
        } as any,
        rejectedEvidence,
      };
    }

    return {
      ok: false,
      failure: {
        message_id: message.id,
        error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
      },
    };
  }
}
