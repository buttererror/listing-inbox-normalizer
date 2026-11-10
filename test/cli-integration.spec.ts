import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCliContext, runCli } from '../src/cli';
import { LlmGateway } from '../src/llm-gateway/llm-request';
import { messageSuccessSchema, processingFailureSchema } from '../src/messages/message-result.schema';

const arabicMessage = {
  id: 'm-arabic-01',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'للبيع شقة، ٣ غرف نوم، السعر ٩٥٠ ألف ريال. للتواصل: ٠٥٥١٢٣٤٥٦٧',
};

const arabicGatewayResponse = {
  classification: 'listing' as const,
  detected_classes: ['listing' as const],
  listings: [
    {
      offer_quote: 'للبيع شقة، ٣ غرف نوم، السعر ٩٥٠ ألف ريال. للتواصل: ٠٥٥١٢٣٤٥٦٧',
      candidates: [
        { field: 'purpose' as const, value: 'sale' as const, quote: 'للبيع', scope: 'local' as const },
        { field: 'property_type' as const, value: 'apartment' as const, quote: 'شقة', scope: 'local' as const },
        { field: 'bedrooms' as const, value: 3, quote: '٣ غرف نوم', scope: 'local' as const },
        {
          field: 'price' as const,
          value: { amount: 950000, currency: 'SAR' as const, period: 'total' as const },
          role: 'asking_price' as const,
          quote: '٩٥٠ ألف ريال',
          scope: 'local' as const,
        },
        { field: 'contact_phone' as const, value: '+966551234567', quote: '٠٥٥١٢٣٤٥٦٧', scope: 'local' as const },
      ],
      findings: [],
    },
  ],
};

const englishMessage = {
  id: 'm-english-01',
  sender: '+966559998888',
  received_at: '2026-11-01T10:00:00+03:00',
  text: 'Villa for sale in City: Riyadh, District: Al Malqa. 5 BR, 6 baths, 380 sqm built-up. Asking 3.2M SAR. Call 0551234567',
};

const englishGatewayResponse = {
  classification: 'listing' as const,
  detected_classes: ['listing' as const],
  listings: [
    {
      offer_quote: 'Villa for sale in City: Riyadh, District: Al Malqa. 5 BR, 6 baths, 380 sqm built-up. Asking 3.2M SAR. Call 0551234567',
      candidates: [
        { field: 'purpose' as const, value: 'sale' as const, quote: 'sale', scope: 'local' as const },
        { field: 'property_type' as const, value: 'villa' as const, quote: 'Villa', scope: 'local' as const },
        { field: 'city' as const, value: 'Riyadh', quote: 'City: Riyadh', scope: 'local' as const },
        { field: 'district' as const, value: 'Al Malqa', quote: 'District: Al Malqa', scope: 'local' as const },
        { field: 'bedrooms' as const, value: 5, quote: '5 BR', scope: 'local' as const },
        { field: 'bathrooms' as const, value: 6, quote: '6 baths', scope: 'local' as const },
        { field: 'area_sqm' as const, value: 380, kind: 'built_up' as const, quote: '380 sqm built-up', scope: 'local' as const },
        {
          field: 'price' as const,
          value: { amount: 3200000, currency: 'SAR' as const, period: 'total' as const },
          role: 'asking_price' as const,
          quote: 'Asking 3.2M SAR',
          scope: 'local' as const,
        },
        { field: 'contact_phone' as const, value: '+966551234567', quote: '0551234567', scope: 'local' as const },
      ],
      findings: [],
    },
  ],
};

const rentalMessage = {
  id: 'm-rent-01',
  sender: '+966551112233',
  received_at: '2026-11-01T11:00:00+03:00',
  text: 'Apartment for rent in Jeddah, 2 bedrooms, rent 45000 SAR yearly. Contact 0551234567',
};

const rentalGatewayResponse = {
  classification: 'listing' as const,
  detected_classes: ['listing' as const],
  listings: [
    {
      offer_quote: 'Apartment for rent in Jeddah, 2 bedrooms, rent 45000 SAR yearly. Contact 0551234567',
      candidates: [
        { field: 'purpose' as const, value: 'rent' as const, quote: 'rent', scope: 'local' as const },
        { field: 'property_type' as const, value: 'apartment' as const, quote: 'Apartment', scope: 'local' as const },
        { field: 'city' as const, value: 'Jeddah', quote: 'Jeddah', scope: 'local' as const },
        { field: 'bedrooms' as const, value: 2, quote: '2 bedrooms', scope: 'local' as const },
        {
          field: 'price' as const,
          value: { amount: 45000, currency: 'SAR' as const, period: 'yearly' as const },
          role: 'asking_price' as const,
          quote: '45000 SAR yearly',
          scope: 'local' as const,
        },
        { field: 'contact_phone' as const, value: '+966551234567', quote: '0551234567', scope: 'local' as const },
      ],
      findings: [],
    },
  ],
};

describe('02.6T — CLI Result Assembly & Ingestion Integration', () => {
  let directory: string;
  let path: string;
  let stdout: string;
  let stderr: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'listing-cli-int-'));
    path = join(directory, 'messages.jsonl');
    stdout = '';
    stderr = '';
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const runWithGateway = async (gateway: LlmGateway): Promise<0 | 1> => {
    return runCli(['process', path], {
      createContext: () => createCliContext({ gateway }),
      stdout: (text: string) => { stdout += text; },
      stderr: (text: string) => { stderr += text; },
    });
  };

  it('processes one Arabic sale message and outputs a contract-compliant public listing result', async () => {
    await writeFile(path, `${JSON.stringify(arabicMessage)}\n`);
    const gateway: LlmGateway = {
      execute: async () => arabicGatewayResponse,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]);
    const validated = messageSuccessSchema.parse(parsed);
    expect(validated.message_id).toBe('m-arabic-01');
    expect(validated.classification).toBe('listing');
    expect(validated.detected_classes).toEqual(['listing']);
    expect(validated.listings).toHaveLength(1);

    const listing = validated.listings[0];
    expect(listing).toMatchObject({
      id: expect.any(String),
      purpose: 'sale',
      property_type: 'apartment',
      bedrooms: 3,
      price: { amount: 950000, currency: 'SAR', period: 'total' },
      contact_phone: '+966551234567',
      duplicate_of: null,
    });
  });

  it('processes a rental listing preserving rent purpose and yearly period', async () => {
    await writeFile(path, `${JSON.stringify(rentalMessage)}\n`);
    const gateway: LlmGateway = {
      execute: async () => rentalGatewayResponse,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);

    const validated = messageSuccessSchema.parse(JSON.parse(lines[0]));
    expect(validated.listings).toHaveLength(1);
    expect(validated.listings[0].purpose).toBe('rent');
    expect(validated.listings[0].price.period).toBe('yearly');
    expect(validated.listings[0].price.amount).toBe(45000);
    expect(validated.listings[0].price.currency).toBe('SAR');
  });

  it('processes two independent messages in input order with distinct IDs', async () => {
    await writeFile(
      path,
      `${JSON.stringify(arabicMessage)}\n${JSON.stringify(englishMessage)}\n`,
    );

    const gateway: LlmGateway = {
      execute: async (req) => {
        if (req.sourceText.includes('للبيع')) return arabicGatewayResponse;
        if (req.sourceText.includes('Villa')) return englishGatewayResponse;
        throw new Error('Unexpected source');
      },
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(2);

    const [first, second] = lines.map((l) => messageSuccessSchema.parse(JSON.parse(l)));

    // First: Arabic sale
    expect(first.message_id).toBe('m-arabic-01');
    expect(first.listings[0].property_type).toBe('apartment');
    expect(first.listings[0].price.amount).toBe(950000);

    // Second: English villa
    expect(second.message_id).toBe('m-english-01');
    expect(second.listings[0].property_type).toBe('villa');
    expect(second.listings[0].city).toBe('Riyadh');
    expect(second.listings[0].district).toBe('Al Malqa');
    expect(second.listings[0].bedrooms).toBe(5);
    expect(second.listings[0].bathrooms).toBe(6);
    expect(second.listings[0].area_sqm).toBe(380);
    expect(second.listings[0].price.amount).toBe(3200000);
    expect(second.listings[0].needs_review).toBe(false);

    expect(first.listings[0].id).not.toBe(second.listings[0].id);
  });

  it('rejects a fabricated quote and flags the field for review with null amount', async () => {
    await writeFile(path, `${JSON.stringify(englishMessage)}\n`);

    const responseWithFabricatedPrice = {
      ...englishGatewayResponse,
      listings: [
        {
          ...englishGatewayResponse.listings[0],
          candidates: englishGatewayResponse.listings[0].candidates.map((c) =>
            c.field === 'price'
              ? { ...c, quote: 'Asking 5.0M SAR' } // Fabricated quote not in source
              : c,
          ),
        },
      ],
    };

    const gateway: LlmGateway = {
      execute: async () => responseWithFabricatedPrice,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);

    const validated = messageSuccessSchema.parse(JSON.parse(lines[0]));
    const listing = validated.listings[0];
    // Rejected candidate cannot select price; amount remains null and triggers review
    expect(listing.price.amount).toBeNull();
    expect(listing.price.currency).toBe('SAR');
    expect(listing.needs_review).toBe(true);
    expect(listing.review_reasons).toContain('price_unsupported');
  });

  it('rejects a candidate with invalid numeric constraint and flags it for review with null value', async () => {
    await writeFile(path, `${JSON.stringify(englishMessage)}\n`);

    const responseWithMismatch = {
      ...englishGatewayResponse,
      listings: [
        {
          ...englishGatewayResponse.listings[0],
          candidates: englishGatewayResponse.listings[0].candidates.map((c) =>
            c.field === 'bedrooms'
              ? { ...c, value: -1, quote: '5 BR' } // Negative bedrooms violates numeric constraint
              : c,
          ),
        },
      ],
    };

    const gateway: LlmGateway = {
      execute: async () => responseWithMismatch,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);

    const validated = messageSuccessSchema.parse(JSON.parse(lines[0]));
    const listing = validated.listings[0];
    expect(listing.bedrooms).toBeNull();
    expect(listing.needs_review).toBe(true);
    expect(listing.review_reasons).toContain('bedrooms_unsupported');
  });

  it('continues after an invalid extraction envelope and exits 1 without diagnostic logs', async () => {
    await writeFile(
      path,
      `${JSON.stringify(arabicMessage)}\n${JSON.stringify(englishMessage)}\n`,
    );

    const gateway: LlmGateway = {
      execute: async (req) => {
        // Return malformed candidate envelope for the first message (listing detected but no listings)
        if (req.sourceText.includes('للبيع')) {
          return { classification: 'listing', detected_classes: ['listing'], listings: [] };
        }
        return englishGatewayResponse;
      },
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(1);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(2);

    const failureRecord = JSON.parse(lines[0]);
    expect(processingFailureSchema.safeParse(failureRecord).success).toBe(true);
    expect(failureRecord).toEqual({
      message_id: 'm-arabic-01',
      error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
    });

    const successRecord = JSON.parse(lines[1]);
    const validated = messageSuccessSchema.parse(successRecord);
    expect(validated.message_id).toBe('m-english-01');
    expect(validated.listings[0].property_type).toBe('villa');
  });

  it('continues after an invalid JSONL line and exits 1', async () => {
    await writeFile(
      path,
      `{not-valid-json\n${JSON.stringify(englishMessage)}\n`,
    );

    const gateway: LlmGateway = {
      execute: async () => englishGatewayResponse,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(1);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(2);

    expect(JSON.parse(lines[0])).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid JSONL record' },
    });
    const second = messageSuccessSchema.parse(JSON.parse(lines[1]));
    expect(second.message_id).toBe('m-english-01');
    expect(second.listings[0].property_type).toBe('villa');
  });

  it('outputs public listings for multi-offer messages with independent IDs and review status', async () => {
    const multiOfferResponse = {
      classification: 'listing' as const,
      detected_classes: ['listing' as const],
      listings: [
        englishGatewayResponse.listings[0],
        arabicGatewayResponse.listings[0],
      ],
    };
    const multiOfferMessage = {
      ...englishMessage,
      text: `${englishGatewayResponse.listings[0].offer_quote}\n${arabicGatewayResponse.listings[0].offer_quote}`,
    };
    await writeFile(path, `${JSON.stringify(multiOfferMessage)}\n`);
    const gateway: LlmGateway = {
      execute: async () => multiOfferResponse,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const parsed = JSON.parse(stdout.trim());
    const validated = messageSuccessSchema.parse(parsed);
    expect(validated.listings).toHaveLength(2);
    expect(validated.listings[0].property_type).toBe('villa');
    expect(validated.listings[1].property_type).toBe('apartment');
    expect(validated.listings[0].id).not.toBe(validated.listings[1].id);
  });

  it('outputs public result with empty listings for non-listing classification', async () => {
    const buyerRequestResponse = {
      classification: 'buyer_request' as const,
      detected_classes: ['buyer_request' as const],
      listings: [],
    };
    await writeFile(path, `${JSON.stringify({ ...englishMessage, text: 'Looking for a 3 BR apartment in Riyadh' })}\n`);
    const gateway: LlmGateway = {
      execute: async () => buyerRequestResponse,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const parsed = JSON.parse(stdout.trim());
    const validated = messageSuccessSchema.parse(parsed);
    expect(validated.classification).toBe('buyer_request');
    expect(validated.detected_classes).toEqual(['buyer_request']);
    expect(validated.listings).toEqual([]);
  });

  it('assembles mixed message retaining mixed classification and assembling genuine offer', async () => {
    const mixedResponse = {
      classification: 'mixed' as const,
      detected_classes: ['listing' as const, 'buyer_request' as const],
      listings: [arabicGatewayResponse.listings[0]],
    };
    const mixedMessage = {
      id: 'm-mixed-01',
      sender: '+966551234567',
      received_at: '2026-11-01T09:12:00+03:00',
      text: `${arabicGatewayResponse.listings[0].offer_quote}\nLooking also for 2 BR in Olaya`,
    };
    await writeFile(path, `${JSON.stringify(mixedMessage)}\n`);
    const gateway: LlmGateway = {
      execute: async () => mixedResponse,
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const validated = messageSuccessSchema.parse(JSON.parse(stdout.trim()));
    expect(validated.classification).toBe('mixed');
    expect(validated.detected_classes).toEqual(['listing', 'buyer_request']);
    expect(validated.listings).toHaveLength(1);
    expect(validated.listings[0].property_type).toBe('apartment');
  });

  it('skips blank lines and handles valid-invalid-valid batch with exit 1', async () => {
    const invalidMessage = { id: 'm-inv-01', sender: '+966550000000', received_at: 'invalid-date', text: 'Some text' };
    await writeFile(
      path,
      `\n${JSON.stringify(arabicMessage)}\n   \n${JSON.stringify(invalidMessage)}\n\n${JSON.stringify(englishMessage)}\n`,
    );

    const gatewayCall = jest.fn(async (req: any) => {
      if (req.sourceText.includes('للبيع')) return arabicGatewayResponse;
      if (req.sourceText.includes('Villa')) return englishGatewayResponse;
      throw new Error('Unexpected');
    });
    const gateway: LlmGateway = { execute: gatewayCall };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(1);
    expect(stderr).toBe('');

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(3);

    // Line 1: valid Arabic message
    const first = messageSuccessSchema.parse(JSON.parse(lines[0]));
    expect(first.message_id).toBe('m-arabic-01');

    // Line 2: invalid message -> typed failure, zero gateway calls for that line!
    const second = JSON.parse(lines[1]);
    expect(second).toEqual({
      message_id: 'm-inv-01',
      error: { code: 'invalid_input', message: 'Invalid message' },
    });

    // Line 3: valid English message
    const third = messageSuccessSchema.parse(JSON.parse(lines[2]));
    expect(third.message_id).toBe('m-english-01');

    // Exactly 2 gateway calls were made (none for the invalid message)
    expect(gatewayCall).toHaveBeenCalledTimes(2);
  });
});
