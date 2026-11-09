import type { ListingResult } from '../messages/message-result.schema';
import type { NormalizedAssertion, NormalizationFinding } from './normalize-supported-assertions';
import { selectAreaCandidates } from './normalize-supported-assertions';
import type { RejectedEvidence } from '../extraction/verify-source-integrity';

export interface ResolveListingInput {
  id: string;
  values: readonly NormalizedAssertion[];
  findings?: readonly NormalizationFinding[];
  rejectedEvidence?: readonly RejectedEvidence[];
  duplicate_of?: string | null;
}

export interface ResolvedListing {
  listing: ListingResult;
  selectedAreaKind?: 'land' | 'built_up' | 'unspecified';
  evidence: {
    values: NormalizedAssertion[];
    findings: NormalizationFinding[];
    rejectedEvidence: RejectedEvidence[];
  };
}

export function resolveListing(input: ResolveListingInput): ResolvedListing {
  const values = [...input.values];
  const findings = [...(input.findings ?? [])];
  const rejectedEvidence = [...(input.rejectedEvidence ?? [])];
  const review_reasons: string[] = [];

  const hasFindingOrRejection = (field: string) =>
    findings.some((f) => f.assertion.field === field) ||
    rejectedEvidence.some((r) => r.assertion.field === field);

  // 1. purpose
  const purposeValues = values.filter((v): v is NormalizedAssertion & { field: 'purpose' } => v.field === 'purpose');
  let purpose: 'sale' | 'rent' | null = null;
  if (purposeValues.length > 0) {
    const distinct = [...new Set(purposeValues.map((v) => v.value))];
    if (distinct.length === 1) {
      purpose = distinct[0];
    } else {
      review_reasons.push('purpose_conflict');
    }
  } else {
    review_reasons.push(hasFindingOrRejection('purpose') ? 'purpose_unsupported' : 'purpose_missing');
  }

  // 2. property_type
  const typeValues = values.filter((v): v is NormalizedAssertion & { field: 'property_type' } => v.field === 'property_type');
  let property_type: 'villa' | 'apartment' | 'studio' | 'land' | 'townhouse' | 'other' | null = null;
  if (typeValues.length > 0) {
    const distinct = [...new Set(typeValues.map((v) => v.value))];
    if (distinct.length === 1) {
      property_type = distinct[0];
    } else {
      review_reasons.push('property_type_conflict');
    }
  } else {
    review_reasons.push(hasFindingOrRejection('property_type') ? 'property_type_unsupported' : 'property_type_missing');
  }

  // 3. city
  const cityValues = values.filter((v): v is NormalizedAssertion & { field: 'city' } => v.field === 'city');
  let city: string | null = null;
  if (cityValues.length > 0) {
    const distinct = [...new Set(cityValues.map((v) => v.value))];
    if (distinct.length === 1) {
      city = distinct[0];
    } else {
      review_reasons.push('city_conflict');
    }
  } else {
    review_reasons.push(hasFindingOrRejection('city') ? 'city_unsupported' : 'city_missing');
  }

  // 4. district
  const districtValues = values.filter((v): v is NormalizedAssertion & { field: 'district' } => v.field === 'district');
  let district: string | null = null;
  if (districtValues.length > 0) {
    const distinct = [...new Set(districtValues.map((v) => v.value))];
    if (distinct.length === 1) {
      district = distinct[0];
    } else {
      review_reasons.push('district_conflict');
    }
  } else {
    review_reasons.push(hasFindingOrRejection('district') ? 'district_unsupported' : 'district_missing');
  }

  // 5. contact_phone
  const contactValues = values.filter((v): v is NormalizedAssertion & { field: 'contact_phone' } => v.field === 'contact_phone');
  let contact_phone: string | null = null;
  if (contactValues.length > 0) {
    const distinct = [...new Set(contactValues.map((v) => v.value))];
    if (distinct.length === 1) {
      contact_phone = distinct[0];
    } else {
      review_reasons.push('contact_phone_conflict');
    }
  } else {
    review_reasons.push(hasFindingOrRejection('contact_phone') ? 'contact_phone_unsupported' : 'contact_phone_missing');
  }

  // 6. bedrooms (inapplicable to land)
  let bedrooms: number | null = null;
  if (property_type !== 'land') {
    const bedroomValues = values.filter((v): v is NormalizedAssertion & { field: 'bedrooms' } => v.field === 'bedrooms');
    if (bedroomValues.length > 0) {
      const distinct = [...new Set(bedroomValues.map((v) => v.value))];
      if (distinct.length === 1) {
        bedrooms = distinct[0];
      } else {
        review_reasons.push('bedrooms_conflict');
      }
    } else if (property_type !== null) {
      review_reasons.push(hasFindingOrRejection('bedrooms') ? 'bedrooms_unsupported' : 'bedrooms_missing');
    }
  }

  // 7. bathrooms (inapplicable to land)
  let bathrooms: number | null = null;
  if (property_type !== 'land') {
    const bathroomValues = values.filter((v): v is NormalizedAssertion & { field: 'bathrooms' } => v.field === 'bathrooms');
    if (bathroomValues.length > 0) {
      const distinct = [...new Set(bathroomValues.map((v) => v.value))];
      if (distinct.length === 1) {
        bathrooms = distinct[0];
      } else {
        review_reasons.push('bathrooms_conflict');
      }
    } else if (property_type !== null) {
      review_reasons.push(hasFindingOrRejection('bathrooms') ? 'bathrooms_unsupported' : 'bathrooms_missing');
    }
  }

  // 8. area_sqm
  const landSelection = selectAreaCandidates(values, 'land') as Array<
    NormalizedAssertion & { field: 'area_sqm' }
  >;
  const builtSelection = selectAreaCandidates(values, 'built') as Array<
    NormalizedAssertion & { field: 'area_sqm' }
  >;

  let area_sqm: number | null = null;
  let selectedAreaKind: 'land' | 'built_up' | 'unspecified' | undefined;

  if (property_type !== null) {
    const propertyCategory = property_type === 'land' ? 'land' : 'built';
    const areaCandidates = propertyCategory === 'land' ? landSelection : builtSelection;
    if (areaCandidates.length > 0) {
      const distinct = [...new Set(areaCandidates.map((v) => v.value))];
      if (distinct.length === 1) {
        area_sqm = distinct[0];
        selectedAreaKind = areaCandidates[0].kind;
      } else {
        review_reasons.push('area_sqm_conflict');
      }
    } else {
      review_reasons.push(hasFindingOrRejection('area_sqm') ? 'area_sqm_unsupported' : 'area_sqm_missing');
    }
  } else {
    // property_type is unresolved (missing, unsupported, or conflicting)
    const landDistinct = [...new Set(landSelection.map((v) => v.value))];
    const builtDistinct = [...new Set(builtSelection.map((v) => v.value))];
    const landArea = landDistinct.length === 1 ? landDistinct[0] : null;
    const builtArea = builtDistinct.length === 1 ? builtDistinct[0] : null;

    if (landArea !== null && builtArea !== null && landArea === builtArea) {
      area_sqm = landArea;
      if (landSelection[0].kind === builtSelection[0].kind) {
        selectedAreaKind = landSelection[0].kind;
      }
    } else if (landSelection.length === 0 && builtSelection.length === 0) {
      review_reasons.push(hasFindingOrRejection('area_sqm') ? 'area_sqm_unsupported' : 'area_sqm_missing');
    } else {
      // The property category changes the selection, or candidates conflict
      review_reasons.push('area_sqm_conflict');
    }
  }

  // 9. price
  const priceValues = values.filter((v): v is NormalizedAssertion & { field: 'price' } => v.field === 'price');
  let price: { amount: number | null; currency: 'SAR'; period: 'total' | 'yearly' | 'monthly' | null } = {
    amount: null,
    currency: 'SAR',
    period: null,
  };
  if (priceValues.length > 0) {
    const distinctAmounts = [...new Set(priceValues.map((v) => v.value.amount))];
    if (distinctAmounts.length === 1) {
      price = {
        amount: distinctAmounts[0],
        currency: 'SAR',
        period: priceValues[0].value.period,
      };
    } else {
      review_reasons.push('price_conflict');
    }
  } else {
    review_reasons.push(hasFindingOrRejection('price') ? 'price_unsupported' : 'price_missing');
  }

  const fields = ['purpose', 'property_type', 'city', 'district', 'contact_phone', 'bedrooms', 'bathrooms', 'area_sqm', 'price'];
  for (const field of fields) {
    if (property_type === 'land' && (field === 'bedrooms' || field === 'bathrooms')) continue;
    if (!rejectedEvidence.some((item) => item.reason === 'field_uncertain' && item.assertion.field === field)) continue;
    const unsupportedIndex = review_reasons.indexOf(`${field}_unsupported`);
    if (unsupportedIndex !== -1) review_reasons.splice(unsupportedIndex, 1);
    review_reasons.push(`${field}_uncertain`);
  }

  const listing: ListingResult = {
    id: input.id,
    purpose,
    property_type,
    city,
    district,
    bedrooms,
    bathrooms,
    area_sqm,
    price,
    contact_phone,
    needs_review: review_reasons.length > 0,
    review_reasons,
    duplicate_of: input.duplicate_of ?? null,
  };

  return {
    listing,
    selectedAreaKind,
    evidence: {
      values,
      findings,
      rejectedEvidence,
    },
  };
}
