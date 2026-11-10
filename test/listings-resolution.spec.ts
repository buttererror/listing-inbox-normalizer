import type { TypedFieldCandidate } from '../src/extraction/extraction-result.schema';
import type {
  OfferValidationOutcome,
  RejectedCandidate,
  ValidationFinding,
} from '../src/extraction/stage2-mechanical-validation';
import { resolveOffer } from '../src/listings/resolve-offer';

const candidate = <Field extends TypedFieldCandidate['field']>(
  value: Extract<TypedFieldCandidate, { field: Field }>,
): Extract<TypedFieldCandidate, { field: Field }> => value;

function offer(overrides: Partial<OfferValidationOutcome> = {}): OfferValidationOutcome {
  return {
    offer_index: 0,
    offer_quote: 'Offer evidence',
    acceptedCandidates: [],
    rejectedCandidates: [],
    semanticFindings: [],
    rejectedFindings: [],
    validationFindings: [],
    ...overrides,
  };
}

function completeCandidates(): TypedFieldCandidate[] {
  return [
    candidate({ field: 'purpose', value: 'sale', quote: 'For sale', scope: 'local' }),
    candidate({ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }),
    candidate({ field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' }),
    candidate({ field: 'district', value: 'Al Malqa', quote: 'Al Malqa', scope: 'local' }),
    candidate({ field: 'bedrooms', value: 5, quote: '5 BR', scope: 'local' }),
    candidate({ field: 'bathrooms', value: 6, quote: '6 baths', scope: 'local' }),
    candidate({ field: 'area_sqm', value: 380, kind: 'built_up', quote: '380 sqm built-up', scope: 'local' }),
    candidate({
      field: 'price',
      value: { amount: 3200000, currency: 'SAR', period: 'total' },
      role: 'asking_price',
      quote: 'Asking 3.2M SAR',
      scope: 'local',
    }),
    candidate({ field: 'contact_phone', value: '+966551234567', quote: '0551234567', scope: 'local' }),
  ];
}

describe('02.5T — Stage 3 field resolution (R01–R14)', () => {
  it('R01: One supported value per field — selects all values and preserves selected provenance', () => {
    const resolved = resolveOffer(offer({ acceptedCandidates: completeCandidates() }));

    expect(resolved.fields).toEqual({
      purpose: 'sale',
      property_type: 'villa',
      city: 'Riyadh',
      district: 'Al Malqa',
      bedrooms: 5,
      bathrooms: 6,
      area_sqm: 380,
      price: { amount: 3200000, currency: 'SAR', period: 'total' },
      contact_phone: '+966551234567',
    });
    expect(resolved.findings).toEqual([]);
    expect(resolved.selectedAreaKind).toBe('built_up');
    expect(resolved.provenance.price.selectedCandidates).toHaveLength(1);
    expect(resolved.provenance.bedrooms.selectedCandidates).toHaveLength(1);
  });

  it('R02: Two identical bedroom values — selects once with no conflict', () => {
    const br1 = candidate({ field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' });
    const br2 = candidate({ field: 'bedrooms', value: 4, quote: '٤ غرف نوم', scope: 'local' });
    const resolved = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }),
        br1,
        br2,
      ],
    }));

    expect(resolved.fields.bedrooms).toBe(4);
    expect(resolved.findings).not.toContainEqual({ field: 'bedrooms', issue: 'conflict' });
    expect(resolved.provenance.bedrooms.selectedCandidates).toHaveLength(2);
  });

  it('R03: Bedrooms 3 and 4 — leaves bedrooms null and preserves conflict finding', () => {
    const resolved = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }),
        candidate({ field: 'bedrooms', value: 3, quote: '3 BR', scope: 'local' }),
        candidate({ field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' }),
      ],
    }));

    expect(resolved.fields.bedrooms).toBeNull();
    expect(resolved.findings).toContainEqual({ field: 'bedrooms', issue: 'conflict' });
    expect(resolved.provenance.bedrooms.selectedCandidates).toEqual([]);
  });

  it('R04: Missing district — leaves district null and records missing finding', () => {
    const candidatesWithoutDistrict = completeCandidates().filter((c) => c.field !== 'district');
    const resolved = resolveOffer(offer({ acceptedCandidates: candidatesWithoutDistrict }));

    expect(resolved.fields.district).toBeNull();
    expect(resolved.findings).toContainEqual({ field: 'district', issue: 'missing' });
    expect(resolved.provenance.district.selectedCandidates).toEqual([]);
  });

  it('R05: Land without bedrooms or bathrooms — both null, marked inapplicable', () => {
    const resolved = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'land', quote: 'Land', scope: 'local' }),
        candidate({ field: 'area_sqm', value: 450, kind: 'land', quote: '450 sqm land', scope: 'local' }),
      ],
    }));

    expect(resolved.fields.bedrooms).toBeNull();
    expect(resolved.fields.bathrooms).toBeNull();
    expect(resolved.applicability.bedrooms).toBe('inapplicable');
    expect(resolved.applicability.bathrooms).toBe('inapplicable');
    expect(resolved.findings).not.toContainEqual({ field: 'bedrooms', issue: 'missing' });
    expect(resolved.findings).not.toContainEqual({ field: 'bathrooms', issue: 'missing' });
  });

  it('R06: Land area 300 and built-up area 200 — applies D-020 area policy', () => {
    const areas: TypedFieldCandidate[] = [
      candidate({ field: 'area_sqm', value: 300, kind: 'land', quote: '300 sqm land', scope: 'local' }),
      candidate({ field: 'area_sqm', value: 200, kind: 'built_up', quote: '200 sqm built-up', scope: 'local' }),
    ];

    // Under D-020: villa prefers built-up (200), land prefers land (300)
    const villa = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }),
        ...areas,
      ],
    }));
    expect(villa.fields.area_sqm).toBe(200);
    expect(villa.selectedAreaKind).toBe('built_up');

    const land = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'land', quote: 'Land', scope: 'local' }),
        ...areas,
      ],
    }));
    expect(land.fields.area_sqm).toBe(300);
    expect(land.selectedAreaKind).toBe('land');

    // Under D-020: unresolved/other property type requires land and built projections to agree on value; here 300 != 200 -> conflict
    const other = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'other', quote: 'Property', scope: 'local' }),
        ...areas,
      ],
    }));
    expect(other.fields.area_sqm).toBeNull();
    expect(other.findings).toContainEqual({ field: 'area_sqm', issue: 'conflict' });
  });

  it('R07: Asking price 950000 plus deposit 50000 — selects asking price 950000', () => {
    const asking = candidate({
      field: 'price',
      value: { amount: 950000, currency: 'SAR', period: 'total' },
      role: 'asking_price',
      quote: 'Asking 950K SAR',
      scope: 'local',
    });
    const deposit = candidate({
      field: 'price',
      value: { amount: 50000, currency: 'SAR', period: 'total' },
      role: 'deposit',
      quote: 'Deposit 50K SAR',
      scope: 'local',
    });
    const resolved = resolveOffer(offer({ acceptedCandidates: [asking, deposit] }));

    expect(resolved.fields.price).toEqual({ amount: 950000, currency: 'SAR', period: 'total' });
    expect(resolved.provenance.price.selectedCandidates).toEqual([asking]);
  });

  it('R08: Two asking prices: 950000 and 1000000 — price.amount null, preserves conflict', () => {
    const p1 = candidate({
      field: 'price',
      value: { amount: 950000, currency: 'SAR', period: 'total' },
      role: 'asking_price',
      quote: '950K SAR',
      scope: 'local',
    });
    const p2 = candidate({
      field: 'price',
      value: { amount: 1000000, currency: 'SAR', period: 'total' },
      role: 'asking_price',
      quote: '1M SAR',
      scope: 'local',
    });
    const resolved = resolveOffer(offer({ acceptedCandidates: [p1, p2] }));

    expect(resolved.fields.price).toEqual({ amount: null, currency: 'SAR', period: null });
    expect(resolved.findings).toContainEqual({ field: 'price', issue: 'conflict' });
    expect(resolved.provenance.price.selectedCandidates).toEqual([]);
  });

  it('R09: Rent 85000 SAR/yearly — preserves explicit yearly period', () => {
    const resolved = resolveOffer(offer({
      acceptedCandidates: [candidate({
        field: 'price',
        value: { amount: 85000, currency: 'SAR', period: 'yearly' },
        role: 'asking_price',
        quote: '85K SAR/yr',
        scope: 'local',
      })],
    }));

    expect(resolved.fields.price).toEqual({ amount: 85000, currency: 'SAR', period: 'yearly' });
  });

  it('R10: Rent 85000 SAR, period unknown — does not invent yearly/monthly; leaves amount null with period_unknown finding', () => {
    const resolved = resolveOffer(offer({
      acceptedCandidates: [candidate({
        field: 'price',
        value: { amount: 85000, currency: 'SAR', period: null },
        role: 'asking_price',
        quote: '85K SAR rent',
        scope: 'local',
      })],
    }));

    // Under D-020: if rental period is unknown, do not default or invent a period; leave amount and period null
    expect(resolved.fields.price).toEqual({ amount: null, currency: 'SAR', period: null });
    expect(resolved.findings).toContainEqual({ field: 'price', issue: 'period_unknown' });
  });

  it('R11: Price with unknown currency — does not publish amount as confirmed SAR; leaves amount null with currency_unknown finding', () => {
    const resolved = resolveOffer(offer({
      acceptedCandidates: [candidate({
        field: 'price',
        value: { amount: 85000, currency: null, period: 'yearly' },
        role: 'asking_price',
        quote: '85,000/yr',
        scope: 'local',
      })],
    }));

    // Under D-020: require explicit SAR evidence; unlabelled currency cannot be confirmed SAR
    expect(resolved.fields.price).toEqual({ amount: null, currency: 'SAR', period: null });
    expect(resolved.findings).toContainEqual({ field: 'price', issue: 'currency_unknown' });
  });

  it('R12: Rejected bedroom candidate plus valid bedroom candidate — selects valid candidate only', () => {
    const rejection: RejectedCandidate = {
      candidate: { field: 'bedrooms', value: 3, quote: '3 BR', scope: 'local' },
      field: 'bedrooms',
      quote: '3 BR',
      scope: 'local',
      reason: 'wrong_offer',
    };
    const validCandidate = candidate({ field: 'bedrooms', value: 4, quote: '4 BR', scope: 'local' });

    const resolved = resolveOffer(offer({
      acceptedCandidates: [
        candidate({ field: 'property_type', value: 'villa', quote: 'Villa', scope: 'local' }),
        validCandidate,
      ],
      rejectedCandidates: [rejection],
    }));

    expect(resolved.fields.bedrooms).toBe(4);
    expect(resolved.findings).not.toContainEqual({ field: 'bedrooms', issue: 'unsupported' });
    expect(resolved.provenance.bedrooms.selectedCandidates).toEqual([validCandidate]);
    expect(resolved.provenance.bedrooms.rejectedCandidates).toEqual([rejection]);
  });

  it('R13: Material semantic uncertainty affecting a field — clears value and records uncertain finding under D-020', () => {
    const resolved = resolveOffer(offer({
      acceptedCandidates: [candidate({ field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' })],
      semanticFindings: [{
        category: 'uncertainty',
        field: 'city',
        quote: 'Riyadh',
        description: 'City reference is ambiguous in context',
      }],
    }));

    // Under D-020: material uncertainty clears the selected value to null and records an uncertain finding
    expect(resolved.fields.city).toBeNull();
    expect(resolved.findings).toContainEqual({ field: 'city', issue: 'uncertain' });
    expect(resolved.provenance.city.selectedCandidates).toEqual([]);
  });

  it('R14: Two offers with different values — resolves each offer independently without cross-contamination', () => {
    const offer1 = resolveOffer(offer({
      offer_index: 0,
      acceptedCandidates: [
        candidate({ field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' }),
        candidate({
          field: 'price',
          value: { amount: 3200000, currency: 'SAR', period: 'total' },
          role: 'asking_price',
          quote: '3.2M SAR',
          scope: 'local',
        }),
      ],
    }));

    const offer2 = resolveOffer(offer({
      offer_index: 1,
      acceptedCandidates: [
        candidate({ field: 'city', value: 'Jeddah', quote: 'Jeddah', scope: 'local' }),
        candidate({
          field: 'price',
          value: { amount: 85000, currency: 'SAR', period: 'yearly' },
          role: 'asking_price',
          quote: '85K SAR/yr',
          scope: 'local',
        }),
      ],
    }));

    expect(offer1.fields.city).toBe('Riyadh');
    expect(offer1.fields.price.amount).toBe(3200000);
    expect(offer2.fields.city).toBe('Jeddah');
    expect(offer2.fields.price).toEqual({ amount: 85000, currency: 'SAR', period: 'yearly' });
  });
});
