/**
 * Human-friendly labels for machine-readable review reason codes.
 *
 * Technical validation codes (such as invalid_schema, invalid_format, and quote_not_in_source)
 * are internal diagnostics and remain on rejected candidate provenance.
 * Runtime review reasons describe business-level property listing problems.
 */
export const REVIEW_REASON_LABELS: Record<string, string> = {
  // Missing applicable fields
  purpose_missing: 'Transaction purpose is missing',
  property_type_missing: 'Property type is missing',
  city_missing: 'City is missing',
  district_missing: 'District is missing',
  bedrooms_missing: 'Bedroom count is missing',
  bathrooms_missing: 'Bathroom count is missing',
  area_sqm_missing: 'Property area is missing',
  price_missing: 'Asking price is missing',
  contact_phone_missing: 'Contact phone is missing',

  // Unsupported fields (invalid candidate with no reliable replacement)
  purpose_unsupported: 'Transaction purpose is missing or unreliable',
  property_type_unsupported: 'Property type is missing or unreliable',
  city_unsupported: 'City is missing or unreliable',
  district_unsupported: 'District is missing or unreliable',
  bedrooms_unsupported: 'Bedroom count is missing or unreliable',
  bathrooms_unsupported: 'Bathroom count is missing or unreliable',
  area_sqm_unsupported: 'Property area is missing or unreliable',
  price_unsupported: 'Asking price is missing or unreliable',
  contact_phone_unsupported: 'Contact phone is missing or unreliable',

  // Conflicts
  purpose_conflict: 'Conflicting transaction purposes',
  property_type_conflict: 'Conflicting property types',
  city_conflict: 'Conflicting cities',
  district_conflict: 'Conflicting districts',
  bedrooms_conflict: 'Conflicting bedroom counts',
  bathrooms_conflict: 'Conflicting bathroom counts',
  area_sqm_conflict: 'Conflicting property areas',
  price_conflict: 'Conflicting asking prices',
  contact_phone_conflict: 'Conflicting contact phones',

  // Currency / Period
  price_currency_unknown: 'Price currency could not be confirmed',
  price_period_unknown: 'Rental price period could not be confirmed',

  // Semantic uncertainty & context
  purpose_uncertain: 'Transaction purpose is uncertain',
  property_type_uncertain: 'Property type is uncertain',
  city_uncertain: 'City is uncertain',
  district_uncertain: 'District is uncertain',
  bedrooms_uncertain: 'Bedroom count is uncertain',
  bathrooms_uncertain: 'Bathroom count is uncertain',
  area_sqm_uncertain: 'Property area is uncertain',
  price_uncertain: 'Asking price is uncertain',
  contact_phone_uncertain: 'Contact phone is uncertain',
  offer_uncertain: 'Offer description is uncertain',
  offer_missing_context: 'Offer is missing essential context',
};

/**
 * Maps a machine-readable review reason code to a human-friendly label.
 * If an unknown reason code is encountered, provides a safe, readable fallback
 * without throwing an error.
 */
export function formatReviewReason(reason: string): string {
  if (REVIEW_REASON_LABELS[reason]) {
    return REVIEW_REASON_LABELS[reason];
  }
  // Safe fallback: replace underscores with spaces and capitalize words
  return reason
    .split('_')
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
