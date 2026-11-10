import type {
  SemanticFinding,
  TypedFieldCandidate,
} from '../extraction/extraction-result.schema';
import type {
  OfferValidationOutcome,
  RejectedCandidate,
  RejectedFinding,
  ValidationFinding,
} from '../extraction/stage2-mechanical-validation';

export const RESOLVED_FIELDS = [
  'purpose',
  'property_type',
  'city',
  'district',
  'bedrooms',
  'bathrooms',
  'area_sqm',
  'price',
  'contact_phone',
] as const;

export type ResolvedField = (typeof RESOLVED_FIELDS)[number];
export type FieldApplicability = 'applicable' | 'optional' | 'inapplicable' | 'uncertain';
export type ResolutionIssue =
  | 'missing'
  | 'conflict'
  | 'uncertain'
  | 'unsupported'
  | 'currency_unknown'
  | 'period_unknown'
  | 'offer_uncertain'
  | 'offer_missing_context';

export interface ResolutionFinding {
  field: ResolvedField | null;
  issue: ResolutionIssue;
}

export interface FieldProvenance {
  acceptedCandidates: TypedFieldCandidate[];
  selectedCandidates: TypedFieldCandidate[];
  rejectedCandidates: RejectedCandidate[];
  semanticFindings: SemanticFinding[];
  rejectedFindings: RejectedFinding[];
  validationFindings: ValidationFinding[];
}

export type OfferFields = {
  purpose: 'sale' | 'rent' | null;
  property_type: 'villa' | 'apartment' | 'studio' | 'land' | 'townhouse' | 'other' | null;
  city: string | null;
  district: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  price: {
    amount: number | null;
    currency: 'SAR';
    period: 'total' | 'yearly' | 'monthly' | null;
  };
  contact_phone: string | null;
};

export interface ResolvedOffer {
  offer_index: number;
  offer_quote: string;
  fields: OfferFields;
  applicability: Record<ResolvedField, FieldApplicability>;
  findings: ResolutionFinding[];
  selectedAreaKind: 'land' | 'built_up' | 'unspecified' | null;
  provenance: Record<ResolvedField, FieldProvenance>;
  semanticFindings: SemanticFinding[];
  rejectedFindings: RejectedFinding[];
  validationFindings: ValidationFinding[];
}

type CandidateFor<Field extends ResolvedField> = Extract<TypedFieldCandidate, { field: Field }>;

interface Selection<Value> {
  value: Value | null;
  selected: TypedFieldCandidate[];
  finding?: ResolutionFinding;
}

const EMPTY_PRICE: OfferFields['price'] = {
  amount: null,
  currency: 'SAR',
  period: null,
};

function candidateKey(candidate: TypedFieldCandidate): string {
  return JSON.stringify(candidate.value);
}

function uniqueCandidates(candidates: readonly TypedFieldCandidate[]): TypedFieldCandidate[] {
  const byValue = new Map<string, TypedFieldCandidate[]>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = byValue.get(key);
    if (existing) existing.push(candidate);
    else byValue.set(key, [candidate]);
  }

  return [...byValue.values()].map((group) => group[0]);
}

function candidatesWithValue(candidates: readonly TypedFieldCandidate[], value: unknown): TypedFieldCandidate[] {
  const key = JSON.stringify(value);
  return candidates.filter((candidate) => candidateKey(candidate) === key);
}

function materialSemanticIssue(
  field: ResolvedField,
  findings: readonly SemanticFinding[],
): 'conflict' | 'uncertain' | undefined {
  const relevant = findings.filter((finding) => finding.field === field);
  if (relevant.some((finding) => finding.category === 'contradiction')) return 'conflict';
  if (relevant.some((finding) => finding.category === 'uncertainty' || finding.category === 'missing_context')) {
    return 'uncertain';
  }
  return undefined;
}

function hasRejectedEvidence(field: ResolvedField, provenance: FieldProvenance): boolean {
  return (
    provenance.rejectedCandidates.length > 0 ||
    provenance.rejectedFindings.length > 0 ||
    provenance.validationFindings.length > 0
  );
}

function resolveSimple<Field extends Exclude<ResolvedField, 'area_sqm' | 'price'>>(
  field: Field,
  applicability: FieldApplicability,
  provenance: FieldProvenance,
  semanticFindings: readonly SemanticFinding[],
): Selection<CandidateFor<Field>['value']> {
  if (applicability === 'inapplicable') return { value: null, selected: [] };

  const candidates = provenance.acceptedCandidates as CandidateFor<Field>[];
  const distinct = uniqueCandidates(candidates);
  if (distinct.length > 1) {
    return { value: null, selected: [], finding: { field, issue: 'conflict' } };
  }

  const semanticIssue = materialSemanticIssue(field, semanticFindings);
  if (semanticIssue) {
    return { value: null, selected: [], finding: { field, issue: semanticIssue } };
  }

  if (distinct.length === 1) {
    const value = distinct[0].value as unknown as CandidateFor<Field>['value'];
    return {
      value,
      selected: candidatesWithValue(candidates, value),
    } as unknown as Selection<CandidateFor<Field>['value']>;
  }

  if (hasRejectedEvidence(field, provenance)) {
    return { value: null, selected: [], finding: { field, issue: 'unsupported' } };
  }
  if (applicability === 'applicable') {
    return { value: null, selected: [], finding: { field, issue: 'missing' } };
  }
  return { value: null, selected: [] };
}

function preferredAreaCandidates(
  candidates: readonly CandidateFor<'area_sqm'>[],
  propertyCategory: 'land' | 'built',
): CandidateFor<'area_sqm'>[] {
  const priorities = propertyCategory === 'land'
    ? ['land', 'unspecified'] as const
    : ['built_up', 'unspecified', 'land'] as const;
  for (const kind of priorities) {
    const selected = candidates.filter((candidate) => candidate.kind === kind);
    if (selected.length > 0) return selected;
  }
  return [];
}

function distinctAreaValue(candidates: readonly CandidateFor<'area_sqm'>[]): number | null | undefined {
  if (candidates.length === 0) return undefined;
  const values = new Set(candidates.map((candidate) => candidate.value));
  return values.size === 1 ? [...values][0] : null;
}

function combineUniqueCandidates(
  first: readonly TypedFieldCandidate[],
  second: readonly TypedFieldCandidate[],
): TypedFieldCandidate[] {
  return [...new Set([...first, ...second])];
}

function resolveArea(
  propertyType: OfferFields['property_type'],
  provenance: FieldProvenance,
  semanticFindings: readonly SemanticFinding[],
): Selection<number> & { kind: ResolvedOffer['selectedAreaKind'] } {
  const candidates = provenance.acceptedCandidates as CandidateFor<'area_sqm'>[];
  const semanticIssue = materialSemanticIssue('area_sqm', semanticFindings);

  if (candidates.length === 0) {
    if (semanticIssue) return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: semanticIssue } };
    if (hasRejectedEvidence('area_sqm', provenance)) {
      return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: 'unsupported' } };
    }
    return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: 'missing' } };
  }

  if (propertyType === 'land' || propertyType === 'villa' || propertyType === 'apartment' || propertyType === 'studio' || propertyType === 'townhouse') {
    const selected = preferredAreaCandidates(candidates, propertyType === 'land' ? 'land' : 'built');
    const value = distinctAreaValue(selected);
    if (value === null) return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: 'conflict' } };
    if (semanticIssue) return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: semanticIssue } };
    if (value === undefined) return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: 'missing' } };
    return { value, selected, kind: selected[0].kind };
  }

  // D-020: unknown and other types are selectable only where both projections agree.
  const landProjection = preferredAreaCandidates(candidates, 'land');
  const builtProjection = preferredAreaCandidates(candidates, 'built');
  const landValue = distinctAreaValue(landProjection);
  const builtValue = distinctAreaValue(builtProjection);
  if (landValue === null || builtValue === null || landValue === undefined || builtValue === undefined || landValue !== builtValue) {
    return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: 'conflict' } };
  }
  if (semanticIssue) return { value: null, selected: [], kind: null, finding: { field: 'area_sqm', issue: semanticIssue } };

  const selected = combineUniqueCandidates(landProjection, builtProjection);
  return {
    value: landValue,
    selected,
    kind: landProjection[0].kind === builtProjection[0].kind ? landProjection[0].kind : null,
  };
}

function resolvePrice(
  provenance: FieldProvenance,
  semanticFindings: readonly SemanticFinding[],
): Selection<OfferFields['price']> {
  const askingPrices = (provenance.acceptedCandidates as CandidateFor<'price'>[])
    .filter((candidate) => candidate.role === 'asking_price');
  const semanticIssue = materialSemanticIssue('price', semanticFindings);
  if (askingPrices.length === 0) {
    if (semanticIssue) return { value: null, selected: [], finding: { field: 'price', issue: semanticIssue } };
    if (hasRejectedEvidence('price', provenance)) {
      return { value: null, selected: [], finding: { field: 'price', issue: 'unsupported' } };
    }
    return { value: null, selected: [], finding: { field: 'price', issue: 'missing' } };
  }

  const distinct = uniqueCandidates(askingPrices);
  if (distinct.length > 1) return { value: null, selected: [], finding: { field: 'price', issue: 'conflict' } };
  if (semanticIssue) return { value: null, selected: [], finding: { field: 'price', issue: semanticIssue } };

  const selected = distinct[0] as CandidateFor<'price'>;
  if (selected.value.currency !== 'SAR') {
    return { value: null, selected: [], finding: { field: 'price', issue: 'currency_unknown' } };
  }
  const period = selected.value.period;
  if (period === null) {
    return { value: null, selected: [], finding: { field: 'price', issue: 'period_unknown' } };
  }
  return {
    value: { amount: selected.value.amount, currency: 'SAR', period },
    selected: candidatesWithValue(askingPrices, selected.value),
  };
}

function roomApplicability(propertyType: OfferFields['property_type'], field: 'bedrooms' | 'bathrooms'): FieldApplicability {
  if (propertyType === 'land') return 'inapplicable';
  if (propertyType === 'studio' && field === 'bedrooms') return 'optional';
  if (propertyType === null || propertyType === 'other') return 'uncertain';
  return 'applicable';
}

function buildProvenance(outcome: OfferValidationOutcome): Record<ResolvedField, FieldProvenance> {
  return Object.fromEntries(RESOLVED_FIELDS.map((field) => [field, {
    acceptedCandidates: outcome.acceptedCandidates.filter((candidate) => candidate.field === field),
    selectedCandidates: [],
    rejectedCandidates: outcome.rejectedCandidates.filter((candidate) => candidate.field === field),
    semanticFindings: outcome.semanticFindings.filter((finding) => finding.field === field),
    rejectedFindings: outcome.rejectedFindings.filter((finding) => finding.field === field),
    validationFindings: outcome.validationFindings.filter((finding) => finding.field === field),
  }])) as unknown as Record<ResolvedField, FieldProvenance>;
}

function addSelection(
  provenance: Record<ResolvedField, FieldProvenance>,
  findings: ResolutionFinding[],
  field: ResolvedField,
  selection: Selection<unknown>,
): void {
  provenance[field].selectedCandidates = selection.selected;
  if (selection.finding) findings.push(selection.finding);
}

/**
 * Deterministically selects public listing values from one Stage 2 validation outcome.
 * It never parses source text, uses rejected candidates, or creates review reasons.
 */
export function resolveOffer(outcome: OfferValidationOutcome): ResolvedOffer {
  const provenance = buildProvenance(outcome);
  const applicability = Object.fromEntries(RESOLVED_FIELDS.map((field) => [field, 'applicable'])) as Record<
    ResolvedField,
    FieldApplicability
  >;
  const findings: ResolutionFinding[] = [];

  const purpose = resolveSimple('purpose', 'applicable', provenance.purpose, outcome.semanticFindings);
  addSelection(provenance, findings, 'purpose', purpose);

  const propertyType = resolveSimple('property_type', 'applicable', provenance.property_type, outcome.semanticFindings);
  addSelection(provenance, findings, 'property_type', propertyType);

  applicability.bedrooms = roomApplicability(propertyType.value, 'bedrooms');
  applicability.bathrooms = roomApplicability(propertyType.value, 'bathrooms');

  const city = resolveSimple('city', 'applicable', provenance.city, outcome.semanticFindings);
  addSelection(provenance, findings, 'city', city);
  const district = resolveSimple('district', 'applicable', provenance.district, outcome.semanticFindings);
  addSelection(provenance, findings, 'district', district);
  const bedrooms = resolveSimple('bedrooms', applicability.bedrooms, provenance.bedrooms, outcome.semanticFindings);
  addSelection(provenance, findings, 'bedrooms', bedrooms);
  const bathrooms = resolveSimple('bathrooms', applicability.bathrooms, provenance.bathrooms, outcome.semanticFindings);
  addSelection(provenance, findings, 'bathrooms', bathrooms);
  const area = resolveArea(propertyType.value, provenance.area_sqm, outcome.semanticFindings);
  addSelection(provenance, findings, 'area_sqm', area);
  const price = resolvePrice(provenance.price, outcome.semanticFindings);
  addSelection(provenance, findings, 'price', price);
  const contactPhone = resolveSimple('contact_phone', 'applicable', provenance.contact_phone, outcome.semanticFindings);
  addSelection(provenance, findings, 'contact_phone', contactPhone);

  for (const finding of outcome.semanticFindings) {
    if (finding.field) continue;
    findings.push({
      field: null,
      issue: finding.category === 'missing_context' ? 'offer_missing_context' : 'offer_uncertain',
    });
  }

  return {
    offer_index: outcome.offer_index,
    offer_quote: outcome.offer_quote,
    fields: {
      purpose: purpose.value,
      property_type: propertyType.value,
      city: city.value,
      district: district.value,
      bedrooms: bedrooms.value,
      bathrooms: bathrooms.value,
      area_sqm: area.value,
      price: price.value ?? EMPTY_PRICE,
      contact_phone: contactPhone.value,
    },
    applicability,
    findings,
    selectedAreaKind: area.kind,
    provenance,
    semanticFindings: [...outcome.semanticFindings],
    rejectedFindings: [...outcome.rejectedFindings],
    validationFindings: [...outcome.validationFindings],
  };
}
