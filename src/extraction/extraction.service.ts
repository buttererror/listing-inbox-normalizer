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
} from './extraction-result.schema';
import {
  OfferValidationOutcome,
  validateStage2,
} from './stage2-mechanical-validation';
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
        validationOutcomes?: OfferValidationOutcome[];
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

    // Run Stage 2: Mechanical Validation for structure & source evidence
    const stage2 = validateStage2(message.text, output);
    if (stage2.ok) {
      const listings: ExtractedOffer[] = stage2.offers.map((o) => ({
        offer_quote: o.offer_quote,
        candidates: o.acceptedCandidates,
        findings: o.semanticFindings,
      }));

      const legacyCandidates = listings.map((offer) => ({
        assertions: offer.candidates.map((c) => ({ field: c.field, quote: c.quote })),
      }));

      const allRejectedCandidates = stage2.offers.flatMap((o) => o.rejectedCandidates);
      const allRejectedFindings = stage2.offers.flatMap((o) => o.rejectedFindings);
      const rejectedEvidence: RejectedEvidence[] = [
        ...allRejectedCandidates.map((r) => ({
          assertion: { field: r.field ?? 'unknown', quote: r.quote ?? '' },
          reason: r.reason as any,
        })),
        ...allRejectedFindings.map((r) => ({
          assertion: { field: (r.finding as any)?.field ?? 'finding', quote: (r.finding as any)?.quote ?? '' },
          reason: r.reason as any,
        })),
      ];

      return {
        ok: true,
        result: {
          classification: stage2.classification,
          detected_classes: stage2.detected_classes,
          listings,
          candidates: legacyCandidates,
          validationOutcomes: stage2.offers,
        },
        rejectedEvidence,
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
