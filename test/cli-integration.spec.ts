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
  candidates: [
    {
      assertions: [
        { field: 'purpose', quote: 'للبيع', verdict: 'supported' as const },
        { field: 'property_type', quote: 'شقة', verdict: 'supported' as const },
        { field: 'bedrooms', quote: '٣ غرف نوم', verdict: 'supported' as const },
        { field: 'price', quote: '٩٥٠ ألف ريال', verdict: 'supported' as const },
        { field: 'contact_phone', quote: 'للتواصل: ٠٥٥١٢٣٤٥٦٧', verdict: 'supported' as const },
      ],
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
  candidates: [
    {
      assertions: [
        { field: 'purpose', quote: 'sale', verdict: 'supported' as const },
        { field: 'property_type', quote: 'Villa', verdict: 'supported' as const },
        { field: 'city', quote: 'City: Riyadh', verdict: 'supported' as const },
        { field: 'district', quote: 'District: Al Malqa', verdict: 'supported' as const },
        { field: 'bedrooms', quote: '5 BR', verdict: 'supported' as const },
        { field: 'bathrooms', quote: '6 baths', verdict: 'supported' as const },
        { field: 'area_sqm', quote: '380 sqm built-up', verdict: 'supported' as const },
        { field: 'price', quote: 'Asking 3.2M SAR', verdict: 'supported' as const },
        { field: 'contact_phone', quote: 'Call 0551234567', verdict: 'supported' as const },
      ],
    },
  ],
};

describe('02.6T — Offline CLI integration', () => {
  let directory: string;
  let path: string;
  let stdout: string;
  let stderr: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'listing-026-'));
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

  it('processes one Arabic sale message and outputs a compliant record with review reasons', async () => {
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
    expect(validated.listings).toHaveLength(1);

    const listing = validated.listings[0];
    expect(listing.id).toEqual(expect.any(String));
    expect(listing.purpose).toBe('sale');
    expect(listing.property_type).toBe('apartment');
    expect(listing.bedrooms).toBe(3);
    expect(listing.bathrooms).toBeNull();
    expect(listing.city).toBeNull();
    expect(listing.district).toBeNull();
    expect(listing.area_sqm).toBeNull();
    expect(listing.price).toEqual({ amount: 950000, currency: 'SAR', period: 'total' });
    expect(listing.contact_phone).toBe('+966551234567');
    expect(listing.duplicate_of).toBeNull();
    expect(listing.needs_review).toBe(true);
    expect(listing.review_reasons).toEqual(
      expect.arrayContaining(['city_missing', 'district_missing', 'bathrooms_missing', 'area_sqm_missing']),
    );
  });

  it('processes two independent sales in input order with distinct facts', async () => {
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
    expect(first.listings[0].price).toEqual({ amount: 950000, currency: 'SAR', period: 'total' });
    expect(first.listings[0].needs_review).toBe(true);
    expect(first.listings[0].duplicate_of).toBeNull();

    // Second: English villa
    expect(second.message_id).toBe('m-english-01');
    expect(second.listings[0].property_type).toBe('villa');
    expect(second.listings[0].city).toBe('Riyadh');
    expect(second.listings[0].district).toBe('Al Malqa');
    expect(second.listings[0].bedrooms).toBe(5);
    expect(second.listings[0].bathrooms).toBe(6);
    expect(second.listings[0].area_sqm).toBe(380);
    expect(second.listings[0].price).toEqual({ amount: 3200000, currency: 'SAR', period: 'total' });
    expect(second.listings[0].contact_phone).toBe('+966551234567');
    expect(second.listings[0].needs_review).toBe(false);
    expect(second.listings[0].review_reasons).toEqual([]);
    expect(second.listings[0].duplicate_of).toBeNull();
  });

  it('continues after an invalid extraction envelope and exits 1 without diagnostic logs', async () => {
    await writeFile(
      path,
      `${JSON.stringify(arabicMessage)}\n${JSON.stringify(englishMessage)}\n`,
    );

    const gateway: LlmGateway = {
      execute: async (req) => {
        // Return malformed candidate envelope for the first message
        if (req.sourceText.includes('للبيع')) {
          return { classification: 'listing', candidates: [] };
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
    expect(messageSuccessSchema.safeParse(successRecord).success).toBe(true);
    expect(successRecord.message_id).toBe('m-english-01');
    expect(successRecord.listings[0].price.amount).toBe(3200000);
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
  });
});
