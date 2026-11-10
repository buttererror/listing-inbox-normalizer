import { z } from 'zod';

// Base classes and classifications
export const baseClassSchema = z.enum(['listing', 'project', 'buyer_request', 'irrelevant']);
export type BaseClass = z.infer<typeof baseClassSchema>;

export const messageClassificationSchema = z.enum([
  'listing',
  'project',
  'buyer_request',
  'irrelevant',
  'mixed',
]);
export type MessageClassification = z.infer<typeof messageClassificationSchema>;

export const candidateScopeSchema = z.enum(['local', 'shared']);
export type CandidateScope = z.infer<typeof candidateScopeSchema>;

export const priceRoleSchema = z.enum([
  'asking_price',
  'deposit',
  'installment',
  'per_sqm_rate',
  'other',
]);
export type PriceRole = z.infer<typeof priceRoleSchema>;

// Field candidate schemas
const candidateBase = {
  quote: z.string().min(1),
  scope: candidateScopeSchema,
};

export const purposeCandidateSchema = z.strictObject({
  field: z.literal('purpose'),
  value: z.enum(['sale', 'rent']),
  ...candidateBase,
});

export const propertyTypeCandidateSchema = z.strictObject({
  field: z.literal('property_type'),
  value: z.enum(['villa', 'apartment', 'studio', 'land', 'townhouse', 'other']),
  ...candidateBase,
});

export const cityCandidateSchema = z.strictObject({
  field: z.literal('city'),
  value: z.string().min(1),
  ...candidateBase,
});

export const districtCandidateSchema = z.strictObject({
  field: z.literal('district'),
  value: z.string().min(1),
  ...candidateBase,
});

export const bedroomsCandidateSchema = z.strictObject({
  field: z.literal('bedrooms'),
  value: z.number().int().nonnegative(),
  ...candidateBase,
});

export const bathroomsCandidateSchema = z.strictObject({
  field: z.literal('bathrooms'),
  value: z.number().int().nonnegative(),
  ...candidateBase,
});

export const areaSqmCandidateSchema = z.strictObject({
  field: z.literal('area_sqm'),
  value: z.number().positive(),
  kind: z.enum(['land', 'built_up', 'unspecified']),
  ...candidateBase,
});

export const priceCandidateSchema = z.strictObject({
  field: z.literal('price'),
  value: z.strictObject({
    amount: z.number().positive(),
    currency: z.literal('SAR').nullable(),
    period: z.enum(['total', 'yearly', 'monthly']).nullable(),
  }),
  role: priceRoleSchema,
  ...candidateBase,
});

export const contactPhoneCandidateSchema = z.strictObject({
  field: z.literal('contact_phone'),
  value: z.string().min(1),
  ...candidateBase,
});

export const typedFieldCandidateSchema = z.discriminatedUnion('field', [
  purposeCandidateSchema,
  propertyTypeCandidateSchema,
  cityCandidateSchema,
  districtCandidateSchema,
  bedroomsCandidateSchema,
  bathroomsCandidateSchema,
  areaSqmCandidateSchema,
  priceCandidateSchema,
  contactPhoneCandidateSchema,
]);

export type TypedFieldCandidate = z.infer<typeof typedFieldCandidateSchema>;

// Findings schema
export const semanticFindingCategorySchema = z.enum([
  'uncertainty',
  'contradiction',
  'missing_context',
]);
export type SemanticFindingCategory = z.infer<typeof semanticFindingCategorySchema>;

export const semanticFindingSchema = z.strictObject({
  category: semanticFindingCategorySchema,
  field: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type SemanticFinding = z.infer<typeof semanticFindingSchema>;

export const gatewayFindingWireSchema = z.strictObject({
  category: semanticFindingCategorySchema,
  field: z.string().nullable(),
  quote: z.string().nullable(),
  description: z.string().nullable(),
});

// Extracted offer schemas
export const extractedOfferSchema = z.strictObject({
  offer_quote: z.string().min(1),
  candidates: z.array(typedFieldCandidateSchema),
  findings: z.array(semanticFindingSchema),
});
export type ExtractedOffer = z.infer<typeof extractedOfferSchema>;

export const gatewayOfferWireSchema = z.strictObject({
  offer_quote: z.string(),
  candidates: z.array(typedFieldCandidateSchema),
  findings: z.array(gatewayFindingWireSchema),
});

// Stage 1 Extraction Envelope schemas
export const stage1ExtractionResultSchema = z.strictObject({
  classification: messageClassificationSchema,
  detected_classes: z.array(baseClassSchema),
  listings: z.array(extractedOfferSchema),
});
export type Stage1ExtractionResult = z.infer<typeof stage1ExtractionResultSchema>;

export const stage1GatewayWireSchema = z.strictObject({
  classification: messageClassificationSchema,
  detected_classes: z.array(baseClassSchema),
  listings: z.array(gatewayOfferWireSchema),
});

// Envelope validation helper
export function validateExtractionEnvelope(data: unknown): {
  ok: true;
  data: {
    classification: MessageClassification;
    detected_classes: BaseClass[];
    listings: Array<{
      offer_quote: string;
      candidates: unknown[];
      findings: unknown[];
    }>;
  };
} | { ok: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Response is not an object' };
  }
  const raw = data as Record<string, unknown>;
  const classification = raw.classification;
  const detected_classes = raw.detected_classes;
  const listings = raw.listings;

  const allowedBase: BaseClass[] = ['listing', 'project', 'buyer_request', 'irrelevant'];
  const allowedClassification: MessageClassification[] = [...allowedBase, 'mixed'];

  if (typeof classification !== 'string' || !allowedClassification.includes(classification as MessageClassification)) {
    return { ok: false, error: 'Invalid classification' };
  }
  if (!Array.isArray(detected_classes)) {
    return { ok: false, error: 'detected_classes must be an array' };
  }
  for (const c of detected_classes) {
    if (typeof c !== 'string' || !allowedBase.includes(c as BaseClass)) {
      return { ok: false, error: `Invalid base class in detected_classes: ${String(c)}` };
    }
  }
  if (new Set(detected_classes).size !== detected_classes.length) {
    return { ok: false, error: 'detected_classes contains duplicates' };
  }
  if (classification !== 'mixed') {
    if (detected_classes.length !== 1 || detected_classes[0] !== classification) {
      return { ok: false, error: 'Single intent message must have exactly its base class in detected_classes' };
    }
  } else {
    if (detected_classes.length < 2) {
      return { ok: false, error: 'Mixed message must have at least two distinct substantive base classes' };
    }
  }
  if (!Array.isArray(listings)) {
    return { ok: false, error: 'listings must be an array' };
  }
  const hasListing = detected_classes.includes('listing');
  if (hasListing && listings.length === 0) {
    return { ok: false, error: 'Offers must be present when listing is detected' };
  }
  if (!hasListing && listings.length > 0) {
    return { ok: false, error: 'listings must be empty when listing is not detected' };
  }
  for (const offer of listings) {
    if (typeof offer !== 'object' || offer === null) {
      return { ok: false, error: 'Offer is not an object' };
    }
    const o = offer as Record<string, unknown>;
    if (typeof o.offer_quote !== 'string' || o.offer_quote.length === 0) {
      return { ok: false, error: 'Offer must have a non-empty offer_quote' };
    }
    if (!Array.isArray(o.candidates)) {
      return { ok: false, error: 'Offer candidates must be an array' };
    }
    if (!Array.isArray(o.findings)) {
      return { ok: false, error: 'Offer findings must be an array' };
    }
  }

  return {
    ok: true,
    data: {
      classification: classification as MessageClassification,
      detected_classes: detected_classes as BaseClass[],
      listings: listings as Array<{
        offer_quote: string;
        candidates: unknown[];
        findings: unknown[];
      }>,
    },
  };
}
