import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LLM_GATEWAY, ProviderError } from '../llm-gateway/llm-request';
import type { LlmGateway } from '../llm-gateway/llm-request';
import { ProcessingFailure } from '../messages/message-result.schema';
import { RawMessage } from '../messages/raw-message.schema';
import { DOMAIN_INSTRUCTIONS } from './domain-prompt';
import {
  stage1GatewayWireSchema,
} from './extraction-result.schema';
import {
  ValidatedExtractionOutcome,
  validateStage2,
} from './stage2-mechanical-validation';

export type ExtractionOutcome =
  | {
      ok: true;
      result: ValidatedExtractionOutcome;
    }
  | { ok: false; failure: ProcessingFailure };

@Injectable()
export class ExtractionService {
  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  async extract(message: RawMessage): Promise<ExtractionOutcome> {
    let output: unknown;
    try {
      output = await this.gateway.execute({
        messageId: message.id,
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

    // Stage 2 is the canonical handoff to Listings. Legacy quote assertions never
    // bypass typed candidate validation on the active processing path.
    const stage2 = validateStage2(message.text, output);
    if (stage2.ok) {
      return {
        ok: true,
        result: stage2,
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
