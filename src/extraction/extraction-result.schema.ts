import { z } from 'zod';

// Public extraction result contract (used by downstream Listings 02.4)
const assertionSchema = z.strictObject({
  field: z.string().min(1),
  quote: z.string().min(1),
});

const candidateSchema = z.strictObject({
  assertions: z.array(assertionSchema),
});

export const extractionResultSchema = z.strictObject({
  classification: z.literal('listing'),
  candidates: z.array(candidateSchema).length(1),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type ExtractionAssertion = ExtractionResult['candidates'][0]['assertions'][number];

// Private gateway response schema (Extraction internal)
export const gatewayAssertionSchema = z.strictObject({
  field: z.string().min(1),
  quote: z.string().min(1),
  verdict: z.enum(['supported', 'contradicted', 'uncertain']),
  context_quote: z.string().nullish(),
});

const gatewayCandidateSchema = z.strictObject({
  assertions: z.array(gatewayAssertionSchema),
});

export const gatewayExtractionResponseSchema = z.strictObject({
  classification: z.literal('listing'),
  candidates: z.array(gatewayCandidateSchema).length(1),
});

// Providers with strict JSON Schema require every object property to be required.
export const gatewayWireResponseSchema = z.strictObject({
  classification: z.literal('listing'),
  candidates: z.array(z.strictObject({
    assertions: z.array(gatewayAssertionSchema.extend({ context_quote: z.string().nullable() })),
  })).length(1),
});

export type GatewayExtractionResponse = z.infer<typeof gatewayExtractionResponseSchema>;
export type GatewayAssertion = GatewayExtractionResponse['candidates'][0]['assertions'][number];
