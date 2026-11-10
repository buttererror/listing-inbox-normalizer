import {
  Stage2ValidationOutcome,
  validateStage2,
} from '../src/extraction/stage2-mechanical-validation';

describe('Stage 2 Verification Matrix — E01–E12, M01–M15, P01–P03', () => {
  const sourceText =
    '١) للبيع فيلا في الرياض، حي الملقا، ٤ غرف نوم، ٣ دورات مياه، المساحة ٣٠٠ م²، السعر ٢ مليون ريال.\n' +
    '٢) للبيع شقة في جدة، حي الروضة، ٣ غرف نوم، ٢ حمام، المساحة ١٦٥ م²، السعر ٩٥٠ ألف ريال، لكن ذُكر أيضًا أن السعر مليون ريال.\n' +
    'للتواصل لكلا العقارين: ٠٥٥١٢٣٤٥٦٧';

  const createBaseExtraction = () => ({
    classification: 'listing' as const,
    detected_classes: ['listing' as const],
    listings: [
      {
        offer_quote:
          '١) للبيع فيلا في الرياض، حي الملقا، ٤ غرف نوم، ٣ دورات مياه، المساحة ٣٠٠ م²، السعر ٢ مليون ريال.',
        candidates: [
          { field: 'purpose' as const, value: 'sale' as const, quote: 'للبيع', scope: 'local' as const },
          { field: 'property_type' as const, value: 'villa' as const, quote: 'فيلا', scope: 'local' as const },
          { field: 'city' as const, value: 'الرياض', quote: 'الرياض', scope: 'local' as const },
          { field: 'district' as const, value: 'الملقا', quote: 'حي الملقا', scope: 'local' as const },
          { field: 'bedrooms' as const, value: 4, quote: '٤ غرف نوم', scope: 'local' as const },
          { field: 'bathrooms' as const, value: 3, quote: '٣ دورات مياه', scope: 'local' as const },
          { field: 'area_sqm' as const, value: 300, kind: 'unspecified' as const, quote: 'المساحة ٣٠٠ م²', scope: 'local' as const },
          {
            field: 'price' as const,
            value: { amount: 2000000, currency: 'SAR' as const, period: 'total' as const },
            role: 'asking_price' as const,
            quote: 'السعر ٢ مليون ريال',
            scope: 'local' as const,
          },
          { field: 'contact_phone' as const, value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'shared' as const },
        ],
        findings: [],
      },
      {
        offer_quote:
          '٢) للبيع شقة في جدة، حي الروضة، ٣ غرف نوم، ٢ حمام، المساحة ١٦٥ م²، السعر ٩٥٠ ألف ريال، لكن ذُكر أيضًا أن السعر مليون ريال.',
        candidates: [
          { field: 'purpose' as const, value: 'sale' as const, quote: 'للبيع', scope: 'local' as const },
          { field: 'property_type' as const, value: 'apartment' as const, quote: 'شقة', scope: 'local' as const },
          { field: 'city' as const, value: 'جدة', quote: 'جدة', scope: 'local' as const },
          { field: 'district' as const, value: 'الروضة', quote: 'حي الروضة', scope: 'local' as const },
          { field: 'bedrooms' as const, value: 3, quote: '٣ غرف نوم', scope: 'local' as const },
          { field: 'bathrooms' as const, value: 2, quote: '٢ حمام', scope: 'local' as const },
          { field: 'area_sqm' as const, value: 165, kind: 'unspecified' as const, quote: 'المساحة ١٦٥ م²', scope: 'local' as const },
          {
            field: 'price' as const,
            value: { amount: 950000, currency: 'SAR' as const, period: 'total' as const },
            role: 'asking_price' as const,
            quote: 'السعر ٩٥٠ ألف ريال',
            scope: 'local' as const,
          },
          {
            field: 'price' as const,
            value: { amount: 1000000, currency: 'SAR' as const, period: 'total' as const },
            role: 'asking_price' as const,
            quote: 'مليون ريال',
            scope: 'local' as const,
          },
          { field: 'contact_phone' as const, value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'shared' as const },
        ],
        findings: [
          {
            category: 'contradiction' as const,
            field: 'price' as const,
            quote: 'لكن ذُكر أيضًا أن السعر مليون ريال',
            description: 'Two conflicting prices mentioned for the apartment',
          },
        ],
      },
    ],
  });

  describe('1. Evidence integrity — Task 02.2 (E01–E12)', () => {
    it('E01: rejects candidate when quote does not exist in source', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'bedrooms' ? { ...c, quote: '٥ غرف نوم' } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'bedrooms')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'bedrooms',
            quote: '٥ غرف نوم',
            reason: 'quote_not_in_source',
          }),
        ]),
      );
    });

    it("E02: rejects villa price candidate when it uses apartment's price quote with scope: local", () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'price'
          ? {
              field: 'price' as const,
              value: { amount: 950000, currency: 'SAR' as const, period: 'total' as const },
              role: 'asking_price' as const,
              quote: 'السعر ٩٥٠ ألف ريال',
              scope: 'local' as const,
            }
          : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'price')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'price',
            quote: 'السعر ٩٥٠ ألف ريال',
            reason: 'wrong_offer',
          }),
        ]),
      );
    });

    it('E03: rejects candidate quote that cuts through an alphanumeric token boundary', () => {
      const extraction = createBaseExtraction();
      // "فيلا في الر" cuts through "الرياض"
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'city' ? { ...c, quote: 'فيلا في الر' } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'city')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'city',
            quote: 'فيلا في الر',
            reason: 'clipped_token',
          }),
        ]),
      );
    });

    it('E04: rejects candidate with invalid field name while retaining others', () => {
      const extraction = createBaseExtraction();
      (extraction.listings[0].candidates as any).push({
        field: 'invalid_field_name',
        value: 'unknown',
        quote: 'فيلا',
        scope: 'local',
      });

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'invalid_field_name',
            reason: 'invalid_schema',
          }),
        ]),
      );
      // Valid candidates are preserved
      expect(villa.acceptedCandidates.length).toBeGreaterThanOrEqual(8);
      expect(villa.acceptedCandidates.find((c) => c.field === 'property_type')?.value).toBe('villa');
    });

    it('E05: rejects candidate with invalid value shape while retaining others', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'purpose' ? ({ ...c, value: 'invalid_enum_purpose' } as any) : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'purpose')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'purpose',
            reason: 'invalid_schema',
          }),
        ]),
      );
      expect(villa.acceptedCandidates.find((c) => c.field === 'bedrooms')?.value).toBe(4);
    });

    it('E06: accepts shared phone occurring outside both offer passages with scope: shared for both offers', () => {
      const extraction = createBaseExtraction();
      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      const apartment = outcome.offers[1];

      const villaPhone = villa.acceptedCandidates.find((c) => c.field === 'contact_phone');
      expect(villaPhone).toEqual(
        expect.objectContaining({
          field: 'contact_phone',
          value: '+966551234567',
          quote: '٠٥٥١٢٣٤٥٦٧',
          scope: 'shared',
        }),
      );

      const apartmentPhone = apartment.acceptedCandidates.find((c) => c.field === 'contact_phone');
      expect(apartmentPhone).toEqual(
        expect.objectContaining({
          field: 'contact_phone',
          value: '+966551234567',
          quote: '٠٥٥١٢٣٤٥٦٧',
          scope: 'shared',
        }),
      );
    });

    it('E07: accepts repeated quote when each occurrence is correctly scoped to its offer', () => {
      const extraction = createBaseExtraction();
      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      const apartment = outcome.offers[1];

      expect(villa.acceptedCandidates.find((c) => c.field === 'purpose')).toEqual(
        expect.objectContaining({ field: 'purpose', value: 'sale', quote: 'للبيع' }),
      );
      expect(apartment.acceptedCandidates.find((c) => c.field === 'purpose')).toEqual(
        expect.objectContaining({ field: 'purpose', value: 'sale', quote: 'للبيع' }),
      );
    });

    it('E08: rejects semantic finding with fabricated quote while retaining both price candidates', () => {
      const extraction = createBaseExtraction();
      extraction.listings[1].findings = [
        {
          category: 'contradiction',
          field: 'price',
          quote: 'سعر مفبرك غير موجود في النص',
          description: 'Fabricated quote finding',
        },
      ];

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];
      expect(apartment.semanticFindings).toHaveLength(0);
      expect(apartment.rejectedFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            quote: 'سعر مفبرك غير موجود في النص',
            reason: 'quote_not_in_source',
          }),
        ]),
      );

      const acceptedPrices = apartment.acceptedCandidates.filter((c) => c.field === 'price');
      expect(acceptedPrices).toHaveLength(2);
      expect(acceptedPrices.map((p: any) => p.value.amount)).toEqual([950000, 1000000]);
    });

    it('E09: rejects semantic finding referencing evidence from the wrong offer', () => {
      const extraction = createBaseExtraction();
      extraction.listings[1].findings = [
        {
          category: 'contradiction',
          field: 'district',
          quote: 'حي الملقا', // belongs exclusively to the villa offer
          description: 'Wrong offer finding evidence',
        },
      ];

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];
      expect(apartment.semanticFindings).toHaveLength(0);
      expect(apartment.rejectedFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            quote: 'حي الملقا',
            reason: 'wrong_offer',
          }),
        ]),
      );
    });

    it('E10: rejects an offer with invalid offer_quote and retains the other grounded offer', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].offer_quote = 'عرض فيلا وهمي غير موجود إطلاقاً في الرسالة';

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      expect(outcome.offers).toHaveLength(1);
      const remainingOffer = outcome.offers[0];
      expect(remainingOffer.offer_index).toBe(1);
      expect(remainingOffer.offer_quote).toContain('للبيع شقة في جدة');
      expect(remainingOffer.acceptedCandidates.find((c) => c.field === 'property_type')?.value).toBe('apartment');
      expect(remainingOffer.semanticFindings).toHaveLength(1);
    });

    it('E11: returns typed invalid_extraction when all claimed offer passages are fabricated', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].offer_quote = 'عرض فيلا غير موجود';
      extraction.listings[1].offer_quote = 'عرض شقة غير موجود';

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;

      expect(outcome.error).toEqual({
        code: 'invalid_extraction',
        message: 'None of the claimed property offers could be grounded in source text',
      });
    });

    it('E12: returns typed invalid_extraction for invalid classification or malformed listings', () => {
      const malformedClassification = {
        classification: 'not_a_valid_classification',
        listings: [],
      };
      const outcome1 = validateStage2(sourceText, malformedClassification);
      expect(outcome1.ok).toBe(false);
      if (!outcome1.ok) {
        expect(outcome1.error.code).toBe('invalid_extraction');
      }

      const malformedListings = {
        classification: 'listing',
        listings: 'not-an-array',
      };
      const outcome2 = validateStage2(sourceText, malformedListings);
      expect(outcome2.ok).toBe(false);
      if (!outcome2.ok) {
        expect(outcome2.error.code).toBe('invalid_extraction');
      }
    });
  });

  describe('2. Mechanical validation — Task 02.4 (M01–M15)', () => {
    it('M01: accepts valid bedrooms count 4 matching quote ٤ غرف نوم', () => {
      const extraction = createBaseExtraction();
      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'bedrooms')).toEqual(
        expect.objectContaining({ field: 'bedrooms', value: 4, quote: '٤ غرف نوم' }),
      );
    });

    it('M02: preserves a grounded bedrooms value even when its quote suggests a different value', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'bedrooms' ? { ...c, value: 5, quote: '٤ غرف نوم' } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'bedrooms', value: 5 }),
      ]));
      expect(villa.rejectedCandidates).toHaveLength(0);
    });

    it('M03: rejects negative bedrooms count -1 as invalid numerical constraint', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'bedrooms' ? { ...c, value: -1 } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'bedrooms')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'bedrooms',
            reason: 'invalid_numeric_constraint',
          }),
        ]),
      );
    });

    it('M04: rejects fractional bedrooms count 2.5 as invalid numerical constraint (integer required)', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'bedrooms' ? { ...c, value: 2.5 } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'bedrooms')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'bedrooms',
            reason: 'invalid_numeric_constraint',
          }),
        ]),
      );
    });

    it('M05: preserves a grounded area value without parsing its quote', () => {
      const extraction = createBaseExtraction();
      extraction.listings[1].candidates = extraction.listings[1].candidates.map((c) =>
        c.field === 'area_sqm' ? { ...c, value: 160, quote: 'المساحة ١٦٥ م²' } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];
      expect(apartment.acceptedCandidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'area_sqm', value: 160 }),
      ]));
      expect(apartment.rejectedCandidates).toHaveLength(0);
    });

    it('M06: rejects nonpositive area 0 as invalid numerical constraint', () => {
      const extraction = createBaseExtraction();
      extraction.listings[1].candidates = extraction.listings[1].candidates.map((c) =>
        c.field === 'area_sqm' ? { ...c, value: 0 } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];
      expect(apartment.acceptedCandidates.find((c) => c.field === 'area_sqm')).toBeUndefined();
      expect(apartment.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'area_sqm',
            reason: 'invalid_numeric_constraint',
          }),
        ]),
      );
    });

    it('M07: accepts price 2000000 with quote السعر ٢ مليون ريال', () => {
      const extraction = createBaseExtraction();
      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      const price = villa.acceptedCandidates.find((c) => c.field === 'price') as any;
      expect(price).toBeDefined();
      expect(price.value.amount).toBe(2000000);
      expect(price.quote).toBe('السعر ٢ مليون ريال');
    });

    it('M08: preserves a grounded price value without interpreting magnitude words', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'price'
          ? {
              ...c,
              value: { amount: 200000, currency: 'SAR' as const, period: 'total' as const },
              quote: 'السعر ٢ مليون ريال',
            }
          : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'price', value: expect.objectContaining({ amount: 200000 }) }),
      ]));
      expect(villa.rejectedCandidates).toHaveLength(0);
    });

    it('M09: accepts phone +966551234567 matching Arabic-Indic digits ٠٥٥١٢٣٤٥٦٧', () => {
      const extraction = createBaseExtraction();
      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      const phone = villa.acceptedCandidates.find((c) => c.field === 'contact_phone');
      expect(phone).toEqual(
        expect.objectContaining({
          field: 'contact_phone',
          value: '+966551234567',
          quote: '٠٥٥١٢٣٤٥٦٧',
        }),
      );
    });

    it('M10: preserves canonical Saudi E.164 phone without comparing source digits', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'contact_phone'
          ? { ...c, value: '+966559999999', quote: '٠٥٥١٢٣٤٥٦٧' }
          : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'contact_phone', value: '+966559999999' }),
      ]));
      expect(villa.rejectedCandidates).toHaveLength(0);
    });

    it('M11: rejects phone 0551234567 as normalized value for not following Saudi E.164 format', () => {
      const extraction = createBaseExtraction();
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'contact_phone' ? { ...c, value: '0551234567' } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.acceptedCandidates.find((c) => c.field === 'contact_phone')).toBeUndefined();
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'contact_phone',
            reason: 'invalid_format',
          }),
        ]),
      );
    });

    it('M12: accepts both distinct price candidates and preserves contradiction finding', () => {
      const extraction = createBaseExtraction();
      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];
      const priceCandidates = apartment.acceptedCandidates.filter((c) => c.field === 'price');
      expect(priceCandidates).toHaveLength(2);
      expect(priceCandidates.map((p: any) => p.value.amount)).toEqual([950000, 1000000]);

      expect(apartment.semanticFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'contradiction',
            field: 'price',
          }),
        ]),
      );
    });

    it('M13: preserves price roles for Stage 1 when quote semantics indicate a deposit (عربون)', () => {
      const customSource =
        '١) للبيع فيلا في الرياض، حي الملقا، ٤ غرف نوم. العربون ٥٠ ألف ريال والسعر ٣٫٢ مليون ريال. للتواصل: ٠٥٥١٢٣٤٥٦٧';
      const extraction = {
        classification: 'listing' as const,
        detected_classes: ['listing' as const],
        listings: [
          {
            offer_quote: 'للبيع فيلا في الرياض، حي الملقا، ٤ غرف نوم. العربون ٥٠ ألف ريال والسعر ٣٫٢ مليون ريال.',
            candidates: [
              {
                field: 'price' as const,
                value: { amount: 50000, currency: 'SAR' as const, period: 'total' as const },
                role: 'asking_price' as const, // Incorrectly assigned asking_price for deposit
                quote: 'العربون ٥٠ ألف ريال',
                scope: 'local' as const,
              },
              {
                field: 'price' as const,
                value: { amount: 3200000, currency: 'SAR' as const, period: 'total' as const },
                role: 'asking_price' as const,
                quote: 'السعر ٣٫٢ مليون ريال',
                scope: 'local' as const,
              },
            ],
            findings: [],
          },
        ],
      };

      const outcome = validateStage2(customSource, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      const acceptedPrices = villa.acceptedCandidates.filter((c) => c.field === 'price');
      expect(acceptedPrices).toHaveLength(2);
      expect(acceptedPrices.map((candidate: any) => candidate.value.amount)).toEqual([50000, 3200000]);
      expect(villa.rejectedCandidates).toHaveLength(0);
    });

    it('M14: accepts null currency for a price without an explicit currency qualifier', () => {
      const extraction = createBaseExtraction();
      extraction.listings[1].candidates = extraction.listings[1].candidates.map((c) =>
        c.field === 'price' && (c as any).value.amount === 1000000
          ? {
              ...c,
              value: { amount: 1000000, currency: null, period: 'total' as const },
              quote: 'مليون ريال',
            }
          : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];
      const nullCurrencyPrice = apartment.acceptedCandidates.find(
        (c) => c.field === 'price' && (c as any).value.amount === 1000000,
      ) as any;
      expect(nullCurrencyPrice).toBeDefined();
      expect(nullCurrencyPrice.value.currency).toBeNull();
    });

    it('M15: rejects candidate with Infinity, NaN, or non-numeric types during validation', () => {
      const extraction = createBaseExtraction();
      // Inject NaN, Infinity, and non-numeric value shapes
      (extraction.listings[0].candidates as any).push(
        { field: 'bedrooms', value: NaN, quote: '٤ غرف نوم', scope: 'local' },
        { field: 'bathrooms', value: Infinity, quote: '٣ دورات مياه', scope: 'local' },
        { field: 'area_sqm', value: 'three hundred', quote: 'المساحة ٣٠٠ م²', scope: 'local' },
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const villa = outcome.offers[0];
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'bedrooms', reason: 'invalid_numeric_constraint' }),
          expect.objectContaining({ field: 'bathrooms', reason: 'invalid_numeric_constraint' }),
          expect.objectContaining({ field: 'area_sqm', reason: 'invalid_numeric_constraint' }),
        ]),
      );
    });
  });

  describe('3. Partial recovery — Combined Stage 2 (P01–P03)', () => {
    it('P01: invalid villa candidate must not affect apartment', () => {
      const extraction = createBaseExtraction();
      // Invalidate villa bedrooms with a mechanical constraint, not quote semantics.
      extraction.listings[0].candidates = extraction.listings[0].candidates.map((c) =>
        c.field === 'bedrooms' ? { ...c, value: -1, quote: '٤ غرف نوم' } : c,
      );

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      // Two grounded offers remain
      expect(outcome.offers).toHaveLength(2);

      const villa = outcome.offers[0];
      const apartment = outcome.offers[1];

      // Villa's mechanically invalid bedroom is rejected, while its price is accepted.
      expect(villa.acceptedCandidates).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'bedrooms', value: -1 }),
        ]),
      );
      expect(villa.rejectedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            candidate: expect.objectContaining({ field: 'bedrooms', value: -1 }),
            reason: expect.any(String),
          }),
        ]),
      );
      expect(villa.acceptedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'price',
            value: expect.objectContaining({ amount: 2000000 }),
          }),
        ]),
      );

      // Apartment bedrooms accepted
      expect(apartment.acceptedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'bedrooms', value: 3 }),
        ]),
      );

      // Both apartment price candidates accepted
      const apartmentPrices = apartment.acceptedCandidates.filter((c) => c.field === 'price');
      expect(apartmentPrices).toHaveLength(2);

      // Apartment contradiction finding preserved
      expect(apartment.semanticFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'contradiction',
            field: 'price',
          }),
        ]),
      );
    });

    it('P02: invalid semantic finding must not affect accepted candidates', () => {
      const extraction = createBaseExtraction();
      // Replace contradiction finding quote with fabricated text
      extraction.listings[1].findings = [
        {
          category: 'contradiction',
          field: 'price',
          quote: 'سعر متناقض وهمي غير موجود في الرسالة',
          description: 'Fabricated contradiction evidence',
        },
      ];

      const outcome = validateStage2(sourceText, extraction);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const apartment = outcome.offers[1];

      // Both price candidates remain accepted
      const apartmentPrices = apartment.acceptedCandidates.filter((c) => c.field === 'price');
      expect(apartmentPrices).toHaveLength(2);
      expect(apartmentPrices.map((p: any) => p.value.amount)).toEqual([950000, 1000000]);

      // Contradiction finding is rejected
      expect(apartment.semanticFindings).toHaveLength(0);
      expect(apartment.rejectedFindings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            quote: 'سعر متناقض وهمي غير موجود في الرسالة',
            reason: 'quote_not_in_source',
          }),
        ]),
      );

      // Competing prices remain intact for downstream resolver
      expect(apartment.acceptedCandidates.find((c) => (c as any).value.amount === 950000)).toBeDefined();
      expect(apartment.acceptedCandidates.find((c) => (c as any).value.amount === 1000000)).toBeDefined();
    });

    it('P03: one ungrounded offer must not invalidate another', () => {
      const extraction = createBaseExtraction();
      // Replace villa offer_quote with text absent from the message
      extraction.listings[0].offer_quote = 'فيلا للبيع في حي الصحافة بقيمة ٥ مليون ريال';

      const outcome = validateStage2(sourceText, extraction);
      // No message-level invalid_extraction because one grounded offer survives
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      expect(outcome.offers).toHaveLength(1);
      const apartment = outcome.offers[0];

      expect(apartment.offer_quote).toContain('للبيع شقة في جدة');
      expect(apartment.acceptedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'property_type', value: 'apartment' }),
          expect.objectContaining({ field: 'bedrooms', value: 3 }),
        ]),
      );
      expect(apartment.semanticFindings).toHaveLength(1);
    });
  });
});
