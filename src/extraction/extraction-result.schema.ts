import { z } from 'zod';

const assertionSchema = z.strictObject({
  field: z.string().min(1),
  quote: z.string().min(1),
});

const candidateSchema = z.strictObject({
  assertions: z.array(assertionSchema),
});

export const extractionResultSchema = z.strictObject({
  classification: z.literal('listing'),
  candidates: z.tuple([candidateSchema]),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
