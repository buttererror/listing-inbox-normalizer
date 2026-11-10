import { z } from 'zod';

export const baseClassificationSchema = z.enum([
  'listing',
  'project',
  'buyer_request',
  'irrelevant',
]);
export type BaseClassification = z.infer<typeof baseClassificationSchema>;

export const messageClassificationSchema = z.enum([
  'listing',
  'project',
  'buyer_request',
  'irrelevant',
  'mixed',
]);
export type MessageClassification = z.infer<typeof messageClassificationSchema>;

export const listingResultSchema = z.looseObject({
  id: z.string(),
  purpose: z.enum(['sale', 'rent']).nullable(),
  property_type: z.enum(['villa', 'apartment', 'studio', 'land', 'townhouse', 'other']).nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  bedrooms: z.number().int().nullable(),
  bathrooms: z.number().int().nullable(),
  area_sqm: z.number().nullable(),
  price: z.looseObject({
    amount: z.number().nullable(),
    currency: z.literal('SAR'),
    period: z.enum(['total', 'yearly', 'monthly']).nullable(),
  }),
  contact_phone: z.string().regex(/^\+9665\d{8}$/).nullable(),
  needs_review: z.boolean(),
  review_reasons: z.array(z.string()),
  duplicate_of: z.string().nullable(),
});

export const messageSuccessSchema = z.looseObject({
  message_id: z.string(),
  classification: messageClassificationSchema,
  detected_classes: z.array(baseClassificationSchema),
  listings: z.array(listingResultSchema),
}).refine(
  (result) => !['buyer_request', 'irrelevant'].includes(result.classification) || result.listings.length === 0,
  { message: 'Buyer requests and irrelevant messages must have no listings', path: ['listings'] },
);

export const processingFailureSchema = z.object({
  message_id: z.string().nullable(),
  error: z.object({
    code: z.enum([
      'invalid_input',
      'message_conflict',
      'provider_unavailable',
      'invalid_extraction',
      'provider_timeout',
      'internal_error',
    ]),
    message: z.string(),
  }),
});

export type ListingResult = z.infer<typeof listingResultSchema>;
export type MessageSuccess = z.infer<typeof messageSuccessSchema>;
export type ProcessingFailure = z.infer<typeof processingFailureSchema>;
