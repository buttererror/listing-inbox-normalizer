import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCliContext, runCli } from '../src/cli';
import { stage1ExtractionResultSchema } from '../src/extraction/extraction-result.schema';
import { LlmGateway } from '../src/llm-gateway/llm-request';
import { processingFailureSchema } from '../src/messages/message-result.schema';

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
        { field: 'contact_phone' as const, value: '+966551234567', quote: 'للتواصل: ٠٥٥١٢٣٤٥٦٧', scope: 'local' as const },
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
        { field: 'contact_phone' as const, value: '+966551234567', quote: 'Call 0551234567', scope: 'local' as const },
      ],
      findings: [],
    },
  ],
};

describe('02.1T / 02.4T — Offline CLI integration', () => {
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

  it('processes one Arabic sale message and outputs a compliant extraction envelope', async () => {
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
    const validated = stage1ExtractionResultSchema.parse(parsed);
    expect(validated.classification).toBe('listing');
    expect(validated.listings).toHaveLength(1);

    const offer = validated.listings[0];
    expect(offer.offer_quote).toContain('للبيع شقة');
    expect(offer.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'purpose', value: 'sale' }),
        expect.objectContaining({ field: 'property_type', value: 'apartment' }),
        expect.objectContaining({ field: 'bedrooms', value: 3 }),
        expect.objectContaining({ field: 'price', value: { amount: 950000, currency: 'SAR', period: 'total' } }),
        expect.objectContaining({ field: 'contact_phone', value: '+966551234567' }),
      ]),
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

    const [first, second] = lines.map((l) => stage1ExtractionResultSchema.parse(JSON.parse(l)));

    // First: Arabic sale
    expect(first.classification).toBe('listing');
    expect(first.listings[0].candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'property_type', value: 'apartment' }),
        expect.objectContaining({ field: 'price', value: { amount: 950000, currency: 'SAR', period: 'total' } }),
      ]),
    );

    // Second: English villa
    expect(second.classification).toBe('listing');
    expect(second.listings[0].candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'property_type', value: 'villa' }),
        expect.objectContaining({ field: 'city', value: 'Riyadh' }),
        expect.objectContaining({ field: 'district', value: 'Al Malqa' }),
        expect.objectContaining({ field: 'bedrooms', value: 5 }),
        expect.objectContaining({ field: 'bathrooms', value: 6 }),
        expect.objectContaining({ field: 'area_sqm', value: 380 }),
        expect.objectContaining({ field: 'price', value: { amount: 3200000, currency: 'SAR', period: 'total' } }),
        expect.objectContaining({ field: 'contact_phone', value: '+966551234567' }),
      ]),
    );
  });

  it('rejects a fabricated quote and drops the candidate from extraction output', async () => {
    await writeFile(path, `${JSON.stringify(englishMessage)}\n`);

    const responseWithFabricatedPrice = {
      ...englishGatewayResponse,
      listings: [
        {
          ...englishGatewayResponse.listings[0],
          candidates: englishGatewayResponse.listings[0].candidates.map((c) =>
            c.field === 'price'
              ? { ...c, quote: 'Asking 5.0M SAR' }
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

    const parsed = stage1ExtractionResultSchema.parse(JSON.parse(lines[0]));
    const priceCandidates = parsed.listings[0].candidates.filter((c) => c.field === 'price');
    expect(priceCandidates).toHaveLength(0);
  });

  it('rejects a candidate with quote/value mismatch and drops it from extraction output', async () => {
    await writeFile(path, `${JSON.stringify(englishMessage)}\n`);

    const responseWithMismatch = {
      ...englishGatewayResponse,
      listings: [
        {
          ...englishGatewayResponse.listings[0],
          candidates: englishGatewayResponse.listings[0].candidates.map((c) =>
            c.field === 'bedrooms'
              ? { ...c, value: 4, quote: '5 BR' } // quote says 5, value proposes 4
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

    const parsed = stage1ExtractionResultSchema.parse(JSON.parse(lines[0]));
    const bedroomCandidates = parsed.listings[0].candidates.filter((c) => c.field === 'bedrooms');
    expect(bedroomCandidates).toHaveLength(0);
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
    expect(stage1ExtractionResultSchema.safeParse(successRecord).success).toBe(true);
    expect(successRecord.listings[0].candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'property_type', value: 'villa' }),
      ]),
    );
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
    const second = stage1ExtractionResultSchema.parse(JSON.parse(lines[1]));
    expect(second.listings[0].candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'property_type', value: 'villa' }),
      ]),
    );
  });

  it('outputs the internal Stage 1 ExtractionEnvelope for multi-offer messages', async () => {
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
    expect(stage1ExtractionResultSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.listings).toHaveLength(2);
  });

  it('outputs the internal Stage 1 ExtractionEnvelope for non-listing classification', async () => {
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
    expect(stage1ExtractionResultSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.classification).toBe('buyer_request');
    expect(parsed.listings).toEqual([]);
  });

  it('outputs failure for invalid extraction response in process', async () => {
    await writeFile(path, `${JSON.stringify(englishMessage)}\n`);
    const gateway: LlmGateway = {
      execute: async () => ({ invalid: 'envelope' }),
    };

    const exitCode = await runWithGateway(gateway);
    expect(exitCode).toBe(1);
    expect(stderr).toBe('');

    const parsed = JSON.parse(stdout.trim());
    expect(parsed).toEqual({
      message_id: 'm-english-01',
      error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
    });
  });
});
