import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createHttpApplication } from '../src/bootstrap';
import { createCliContext, runCli } from '../src/cli';
import { DatabaseService } from '../src/database/database.service';
import { ExtractionService } from '../src/extraction/extraction.service';
import { ListingsService } from '../src/listings/listings.service';
import { LLM_GATEWAY, LlmGateway, ProviderError } from '../src/llm-gateway/llm-request';
import { ListingMessageProcessor } from '../src/messages/listing-message-processor';
import { listingResultSchema, messageSuccessSchema, processingFailureSchema } from '../src/messages/message-result.schema';
import { RawMessage } from '../src/messages/raw-message.schema';

const englishMessage: RawMessage = {
  id: 'http-msg-001',
  sender: '+966559998888',
  received_at: '2026-11-01T10:00:00+03:00',
  text: 'Villa for sale in City: Riyadh, District: Al Malqa. 5 BR, 6 baths, 380 sqm built-up. Asking 3.2M SAR. Call 0551234567',
};

const englishOffer = {
  offer_quote:
    'Villa for sale in City: Riyadh, District: Al Malqa. 5 BR, 6 baths, 380 sqm built-up. Asking 3.2M SAR. Call 0551234567',
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
};

const arabicMessage: RawMessage = {
  id: 'http-msg-002',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'للبيع شقة، ٣ غرف نوم، السعر ٩٥٠ ألف ريال. للتواصل: ٠٥٥١٢٣٤٥٦٧',
};

const arabicOffer = {
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
};

const multiOfferMessage: RawMessage = {
  id: 'http-multi-001',
  sender: '+966550001111',
  received_at: '2026-11-01T11:30:00+03:00',
  text: `${englishOffer.offer_quote}\n${arabicOffer.offer_quote}`,
};

const projectMessage: RawMessage = {
  id: 'http-proj-001',
  sender: '+966552223333',
  received_at: '2026-11-01T12:00:00+03:00',
  text: 'New launch: Al Waha Residences, Jeddah. Off-plan units from SAR 780K.',
};

function deployTemplateDatabase(databasePath: string): void {
  execFileSync('pnpm', ['--silent', 'run', 'db:deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    stdio: 'pipe',
  });
}

describe('Phase 04 HTTP ingestion and listing reads', () => {
  let templateDir: string;
  let templateDbPath: string;
  let testDir: string;
  let testDbPath: string;
  let originalDatabaseUrl: string | undefined;
  let activeApps: INestApplication[];

  beforeAll(() => {
    templateDir = mkdtempSync(join(tmpdir(), 'listing-http-template-'));
    templateDbPath = join(templateDir, 'template.db');
    deployTemplateDatabase(templateDbPath);
  });

  afterAll(() => {
    rmSync(templateDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    activeApps = [];
    testDir = mkdtempSync(join(tmpdir(), 'listing-http-test-'));
    testDbPath = join(testDir, 'phase04.db');
    copyFileSync(templateDbPath, testDbPath);
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${testDbPath}`;
  });

  afterEach(async () => {
    for (const app of activeApps) {
      await app.close();
    }
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    rmSync(testDir, { recursive: true, force: true });
  });

  async function createTestHttpApp(
    gateway: LlmGateway,
    options?: { idGenerator?: () => string },
  ): Promise<INestApplication> {
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_GATEWAY)
      .useValue(gateway);

    if (options?.idGenerator) {
      const idGenerator = options.idGenerator;
      builder.overrideProvider(ListingMessageProcessor).useFactory({
        factory: (extraction: ExtractionService, listings: ListingsService) =>
          new ListingMessageProcessor(extraction, listings, idGenerator),
        inject: [ExtractionService, ListingsService],
      });
    }

    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    activeApps.push(app);
    return app;
  }

  it('ingests multi-offer and zero-offer messages with HTTP 200 and persists ordered records', async () => {
    const execute = jest.fn(async (req: { sourceText: string }) => {
      if (req.sourceText.includes('Villa') && req.sourceText.includes('شقة')) {
        return {
          classification: 'listing',
          detected_classes: ['listing'],
          listings: [englishOffer, arabicOffer],
        };
      }
      if (req.sourceText.includes('Al Waha Residences')) {
        return {
          classification: 'project',
          detected_classes: ['project'],
          listings: [],
        };
      }
      throw new Error('Unexpected message');
    });

    const app = await createTestHttpApp({ execute });
    const database = app.get(DatabaseService);

    const multiRes = await request(app.getHttpServer())
      .post('/messages')
      .send({ ...multiOfferMessage, debug: 'extra-ignored-field' })
      .expect(200);

    const parsedMulti = messageSuccessSchema.parse(multiRes.body);
    expect(parsedMulti.message_id).toBe(multiOfferMessage.id);
    expect(parsedMulti.classification).toBe('listing');
    expect(parsedMulti.listings).toHaveLength(2);
    expect(parsedMulti.listings[0].property_type).toBe('villa');
    expect(parsedMulti.listings[0].needs_review).toBe(false);
    expect(parsedMulti.listings[1].property_type).toBe('apartment');
    expect(parsedMulti.listings[1].needs_review).toBe(true);
    expect(parsedMulti.listings[1].review_reasons).toEqual([
      'city_missing',
      'district_missing',
      'bathrooms_missing',
      'area_sqm_missing',
    ]);

    const projectRes = await request(app.getHttpServer())
      .post('/messages')
      .send(projectMessage)
      .expect(200);

    const parsedProject = messageSuccessSchema.parse(projectRes.body);
    expect(parsedProject.classification).toBe('project');
    expect(parsedProject.listings).toEqual([]);

    const storedMulti = await database.storedMessage.findUniqueOrThrow({
      where: { id: multiOfferMessage.id },
      include: { listings: { orderBy: { offerIndex: 'asc' } } },
    });
    expect(storedMulti.sender).toBe(multiOfferMessage.sender);
    expect(storedMulti.receivedAt).toBe(multiOfferMessage.received_at);
    expect(storedMulti.text).toBe(multiOfferMessage.text);
    expect(JSON.parse(storedMulti.resultSnapshot)).toEqual(parsedMulti);
    expect(storedMulti.listings.map((row) => row.id)).toEqual(
      parsedMulti.listings.map((listing) => listing.id),
    );
    expect(storedMulti.listings.map((row) => row.offerIndex)).toEqual([0, 1]);
    expect(storedMulti.listings[0]).toMatchObject({
      purpose: 'sale',
      propertyType: 'villa',
      city: 'Riyadh',
      needsReview: false,
      originallyNeedsReview: false,
      approvalState: 'pending',
    });
    expect(storedMulti.listings[1]).toMatchObject({
      purpose: 'sale',
      propertyType: 'apartment',
      needsReview: true,
      originallyNeedsReview: true,
      approvalState: 'pending',
    });
    expect(JSON.parse(storedMulti.listings[1].reviewReasons)).toEqual(
      parsedMulti.listings[1].review_reasons,
    );

    const storedProject = await database.storedMessage.findUniqueOrThrow({
      where: { id: projectMessage.id },
      include: { listings: true },
    });
    expect(storedProject.classification).toBe('project');
    expect(storedProject.listings).toEqual([]);
  });

  it('replays identical messages with HTTP 200 and stable IDs across restart without calling the gateway', async () => {
    const execute = jest.fn(async () => ({
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [englishOffer],
    }));

    const firstApp = await createTestHttpApp({ execute });
    const first = await request(firstApp.getHttpServer())
      .post('/messages')
      .send(englishMessage)
      .expect(200);

    const replay = await request(firstApp.getHttpServer())
      .post('/messages')
      .send({ ...englishMessage, ignoredReplayKey: true })
      .expect(200);

    expect(replay.body).toEqual(first.body);
    expect(execute).toHaveBeenCalledTimes(1);

    await firstApp.close();
    activeApps = [];

    const originalProvider = process.env.LLM_PROVIDER;
    const originalApiKey = process.env.LLM_API_KEY;
    process.env.LLM_PROVIDER = 'gemini';
    process.env.LLM_API_KEY = '';

    let restartedProdApp: INestApplication | undefined;
    try {
      restartedProdApp = await createHttpApplication({ logger: false });
      await restartedProdApp.init();

      const afterRestart = await request(restartedProdApp.getHttpServer())
        .post('/messages')
        .send(englishMessage)
        .expect(200);

      expect(afterRestart.body).toEqual(first.body);
    } finally {
      if (restartedProdApp) await restartedProdApp.close();
      if (originalProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = originalProvider;
      if (originalApiKey === undefined) delete process.env.LLM_API_KEY;
      else process.env.LLM_API_KEY = originalApiKey;
    }
  });

  it('returns HTTP 409 message_conflict when an existing ID receives changed sender, received_at, or text', async () => {
    const execute = jest.fn(async () => ({
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [englishOffer],
    }));

    const app = await createTestHttpApp({ execute });
    const database = app.get(DatabaseService);
    const initial = await request(app.getHttpServer()).post('/messages').send(englishMessage).expect(200);

    const variants: RawMessage[] = [
      { ...englishMessage, text: 'Changed listing text' },
      { ...englishMessage, sender: '+966500000000' },
      { ...englishMessage, received_at: '2026-11-01T07:00:00Z' },
    ];

    for (const variant of variants) {
      const res = await request(app.getHttpServer())
        .post('/messages')
        .send(variant)
        .expect(409);

      expect(processingFailureSchema.parse(res.body)).toEqual({
        message_id: englishMessage.id,
        error: {
          code: 'message_conflict',
          message: 'Message ID conflicts with an existing message',
        },
      });
    }

    expect(execute).toHaveBeenCalledTimes(1);
    expect(await database.storedMessage.count()).toBe(1);
    const stored = await database.storedMessage.findUniqueOrThrow({ where: { id: englishMessage.id } });
    expect(JSON.parse(stored.resultSnapshot)).toEqual(initial.body);
  });

  it('keeps one winner for concurrent identical and conflicting HTTP submissions', async () => {
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstEntered = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondEntered = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let callCount = 0;

    const execute = jest.fn(async (req: { sourceText: string }) => {
      callCount += 1;
      if (callCount === 1) releaseFirst();
      if (callCount === 2) releaseSecond();
      await Promise.all([firstEntered, secondEntered]);

      if (req.sourceText.includes('Villa')) {
        return { classification: 'listing', detected_classes: ['listing'], listings: [englishOffer] };
      }
      return { classification: 'listing', detected_classes: ['listing'], listings: [arabicOffer] };
    });

    const app = await createTestHttpApp({ execute });
    const database = app.get(DatabaseService);

    const [identicalA, identicalB] = await Promise.all([
      request(app.getHttpServer()).post('/messages').send(englishMessage),
      request(app.getHttpServer()).post('/messages').send(englishMessage),
    ]);

    expect(identicalA.status).toBe(200);
    expect(identicalB.status).toBe(200);
    expect(identicalA.body).toEqual(identicalB.body);
    expect(await database.storedMessage.count()).toBe(1);

    callCount = 0;
    let releaseConflictA!: () => void;
    let releaseConflictB!: () => void;
    const conflictAEntered = new Promise<void>((resolve) => {
      releaseConflictA = resolve;
    });
    const conflictBEntered = new Promise<void>((resolve) => {
      releaseConflictB = resolve;
    });

    execute.mockImplementation(async (req: { sourceText: string }) => {
      callCount += 1;
      if (callCount === 1) releaseConflictA();
      if (callCount === 2) releaseConflictB();
      await Promise.all([conflictAEntered, conflictBEntered]);
      if (req.sourceText.includes('Villa')) {
        return { classification: 'listing', detected_classes: ['listing'], listings: [englishOffer] };
      }
      return { classification: 'listing', detected_classes: ['listing'], listings: [arabicOffer] };
    });

    const conflictId = 'http-concurrent-conflict';
    const [raceA, raceB] = await Promise.all([
      request(app.getHttpServer()).post('/messages').send({ ...englishMessage, id: conflictId }),
      request(app.getHttpServer()).post('/messages').send({ ...arabicMessage, id: conflictId }),
    ]);

    const statuses = [raceA.status, raceB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const winner = raceA.status === 200 ? raceA : raceB;
    const loser = raceA.status === 409 ? raceA : raceB;

    expect(processingFailureSchema.parse(loser.body)).toEqual({
      message_id: conflictId,
      error: {
        code: 'message_conflict',
        message: 'Message ID conflicts with an existing message',
      },
    });
    const storedWinner = await database.storedMessage.findUniqueOrThrow({ where: { id: conflictId } });
    expect(JSON.parse(storedWinner.resultSnapshot)).toEqual(winner.body);
  });

  it('returns HTTP 400 invalid_input for malformed JSON and invalid payloads without invoking gateway or DB', async () => {
    const execute = jest.fn();
    const app = await createTestHttpApp({ execute });
    const database = app.get(DatabaseService);

    const malformedJson = await request(app.getHttpServer())
      .post('/messages')
      .set('Content-Type', 'application/json')
      .send('{not-valid-json')
      .expect(400);
    expect(processingFailureSchema.parse(malformedJson.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid JSON body' },
    });
    expect(JSON.stringify(malformedJson.body)).not.toContain('not-valid-json');

    const scalarJson = await request(app.getHttpServer())
      .post('/messages')
      .set('Content-Type', 'application/json')
      .send('"just-a-string"')
      .expect(400);
    expect(processingFailureSchema.parse(scalarJson.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid JSON body' },
    });

    const arrayJson = await request(app.getHttpServer())
      .post('/messages')
      .set('Content-Type', 'application/json')
      .send('[]')
      .expect(400);
    expect(processingFailureSchema.parse(arrayJson.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid message' },
    });

    const missingFields = await request(app.getHttpServer())
      .post('/messages')
      .send({})
      .expect(400);
    expect(processingFailureSchema.parse(missingFields.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid message' },
    });

    const invalidTimestamp = await request(app.getHttpServer())
      .post('/messages')
      .send({ ...englishMessage, id: 'm-bad-ts', received_at: 'yesterday' })
      .expect(400);
    expect(processingFailureSchema.parse(invalidTimestamp.body)).toEqual({
      message_id: 'm-bad-ts',
      error: { code: 'invalid_input', message: 'Invalid message' },
    });

    const emptyId = await request(app.getHttpServer())
      .post('/messages')
      .send({ ...englishMessage, id: '' })
      .expect(400);
    expect(processingFailureSchema.parse(emptyId.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid message' },
    });

    const plainText = await request(app.getHttpServer())
      .post('/messages')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(englishMessage))
      .expect(400);
    expect(processingFailureSchema.parse(plainText.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid message' },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(await database.storedMessage.count()).toBe(0);
    expect(await database.storedListing.count()).toBe(0);
  });

  it('maps invalid_extraction (502), provider_unavailable (503), and provider_timeout (504) without storing failures', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ classification: 'listing', detected_classes: ['listing'], listings: [] })
      .mockRejectedValueOnce(new ProviderError('provider_unavailable', 'Provider down'))
      .mockRejectedValueOnce(new ProviderError('provider_timeout', 'Provider timed out'))
      .mockResolvedValueOnce({ classification: 'listing', detected_classes: ['listing'], listings: [englishOffer] });

    const app = await createTestHttpApp({ execute });
    const database = app.get(DatabaseService);

    const invalidExtraction = await request(app.getHttpServer())
      .post('/messages')
      .send(englishMessage)
      .expect(502);
    expect(processingFailureSchema.parse(invalidExtraction.body)).toEqual({
      message_id: englishMessage.id,
      error: { code: 'invalid_extraction', message: 'Invalid extraction response' },
    });

    const unavailable = await request(app.getHttpServer())
      .post('/messages')
      .send(englishMessage)
      .expect(503);
    expect(processingFailureSchema.parse(unavailable.body)).toEqual({
      message_id: englishMessage.id,
      error: { code: 'provider_unavailable', message: 'Provider down' },
    });

    const timeout = await request(app.getHttpServer())
      .post('/messages')
      .send(englishMessage)
      .expect(504);
    expect(processingFailureSchema.parse(timeout.body)).toEqual({
      message_id: englishMessage.id,
      error: { code: 'provider_timeout', message: 'Provider timed out' },
    });

    expect(await database.storedMessage.count()).toBe(0);
    expect(await database.storedListing.count()).toBe(0);

    // Retry with the same ID succeeds after transient failures because failures are never persisted.
    const retry = await request(app.getHttpServer())
      .post('/messages')
      .send(englishMessage)
      .expect(200);
    expect(messageSuccessSchema.parse(retry.body).message_id).toBe(englishMessage.id);
    expect(await database.storedMessage.count()).toBe(1);
    expect(await database.storedListing.count()).toBe(1);
  });

  it('returns HTTP 503 provider_unavailable from unconfigured production createHttpApplication', async () => {
    const originalProvider = process.env.LLM_PROVIDER;
    const originalApiKey = process.env.LLM_API_KEY;
    process.env.LLM_PROVIDER = 'gemini';
    process.env.LLM_API_KEY = '';

    let prodApp: INestApplication | undefined;
    try {
      prodApp = await createHttpApplication({ logger: false });
      await prodApp.init();
      const database = prodApp.get(DatabaseService);

      const res = await request(prodApp.getHttpServer())
        .post('/messages')
        .send(englishMessage)
        .expect(503);

      expect(processingFailureSchema.parse(res.body)).toEqual({
        message_id: englishMessage.id,
        error: { code: 'provider_unavailable', message: 'Extraction is not configured' },
      });
      expect(await database.storedMessage.count()).toBe(0);
    } finally {
      if (prodApp) await prodApp.close();
      if (originalProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = originalProvider;
      if (originalApiKey === undefined) delete process.env.LLM_API_KEY;
      else process.env.LLM_API_KEY = originalApiKey;
    }
  });

  it('returns safe HTTP 500 internal_error on atomic write rollback and unexpected database errors', async () => {
    const execute = jest.fn(async () => ({
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [englishOffer, arabicOffer],
    }));

    const app = await createTestHttpApp({ execute }, { idGenerator: () => 'duplicate-listing-id' });
    const database = app.get(DatabaseService);

    const rollbackRes = await request(app.getHttpServer())
      .post('/messages')
      .send(multiOfferMessage)
      .expect(500);

    expect(processingFailureSchema.parse(rollbackRes.body)).toEqual({
      message_id: multiOfferMessage.id,
      error: { code: 'internal_error', message: 'Message processing failed' },
    });
    expect(await database.storedMessage.count()).toBe(0);
    expect(await database.storedListing.count()).toBe(0);

    const findSpy = jest
      .spyOn(database.storedMessage, 'findUnique')
      .mockRejectedValueOnce(new Error('SQLITE_CANTOPEN: /private/secret/phase04.db'));

    try {
      const dbErrorRes = await request(app.getHttpServer())
        .post('/messages')
        .send(englishMessage)
        .expect(500);

      expect(processingFailureSchema.parse(dbErrorRes.body)).toEqual({
        message_id: englishMessage.id,
        error: { code: 'internal_error', message: 'Message processing failed' },
      });
      expect(JSON.stringify(dbErrorRes.body)).not.toContain('SQLITE_CANTOPEN');
      expect(JSON.stringify(dbErrorRes.body)).not.toContain('/private/secret');
    } finally {
      findSpy.mockRestore();
    }
  });

  it('preserves /health liveness and default 404 handling for non-/messages routes', async () => {
    const app = await createTestHttpApp({ execute: jest.fn() });

    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
    const notFound = await request(app.getHttpServer()).get('/unknown-route').expect(404);
    expect(notFound.body).toMatchObject({ statusCode: 404 });
  });

  it('matches CLI output against the same SQLite database without CLI persistence or replay side effects', async () => {
    const gateway: LlmGateway = {
      execute: jest.fn(async (req) => {
        if (req.sourceText.includes('Villa') && req.sourceText.includes('شقة')) {
          return {
            classification: 'listing',
            detected_classes: ['listing'],
            listings: [englishOffer, arabicOffer],
          };
        }
        if (req.sourceText.includes('Al Waha Residences')) {
          return {
            classification: 'project',
            detected_classes: ['project'],
            listings: [],
          };
        }
        throw new Error('Unexpected message');
      }),
    };

    const jsonlPath = join(testDir, 'batch.jsonl');
    await writeFile(jsonlPath, `${JSON.stringify(multiOfferMessage)}\n${JSON.stringify(projectMessage)}\n`);

    let cliStdout = '';
    let cliStderr = '';
    const cliExit = await runCli(['process', jsonlPath], {
      createContext: () => createCliContext({ gateway }),
      stdout: (chunk) => {
        cliStdout += chunk;
      },
      stderr: (chunk) => {
        cliStderr += chunk;
      },
    });
    expect(cliExit).toBe(0);
    expect(cliStderr).toBe('');

    const cliResults = cliStdout
      .trim()
      .split('\n')
      .map((line) => messageSuccessSchema.parse(JSON.parse(line)));

    const app = await createTestHttpApp(gateway);
    const database = app.get(DatabaseService);

    // CLI left the shared SQLite database completely empty.
    expect(await database.storedMessage.count()).toBe(0);
    expect(await database.storedListing.count()).toBe(0);

    const httpMulti = messageSuccessSchema.parse(
      (await request(app.getHttpServer()).post('/messages').send(multiOfferMessage).expect(200)).body,
    );
    const httpProject = messageSuccessSchema.parse(
      (await request(app.getHttpServer()).post('/messages').send(projectMessage).expect(200)).body,
    );

    const normalizeIds = (result: typeof httpMulti) => ({
      ...result,
      listings: result.listings.map(({ id: _id, ...rest }) => rest),
    });

    expect(normalizeIds(httpMulti)).toEqual(normalizeIds(cliResults[0]));
    expect(normalizeIds(httpProject)).toEqual(normalizeIds(cliResults[1]));

    // Re-running CLI with the same message ID and changed text against the populated database
    // does not replay HTTP rows or report message_conflict, and leaves HTTP DB records untouched.
    const changedSameIdPath = join(testDir, 'changed.jsonl');
    await writeFile(
      changedSameIdPath,
      `${JSON.stringify({ ...projectMessage, text: 'New launch: Al Waha Residences changed' })}\n`,
    );
    let secondStdout = '';
    const secondExit = await runCli(['process', changedSameIdPath], {
      createContext: () => createCliContext({ gateway }),
      stdout: (chunk) => {
        secondStdout += chunk;
      },
      stderr: () => {},
    });
    expect(secondExit).toBe(0);
    expect(messageSuccessSchema.parse(JSON.parse(secondStdout.trim())).classification).toBe('project');

    const storedAfter = await database.storedMessage.findUniqueOrThrow({ where: { id: projectMessage.id } });
    expect(storedAfter.text).toBe(projectMessage.text);
  });

  it('lists current stored listings in ingestion and offer order with strict needs_review filters', async () => {
    const execute = jest.fn(async (request: { sourceText: string }) => ({
      classification: 'listing',
      detected_classes: ['listing'],
      listings: request.sourceText.includes('Villa') && request.sourceText.includes('شقة')
        ? [englishOffer, arabicOffer]
        : [englishOffer],
    }));
    const app = await createTestHttpApp({ execute });

    const multi = messageSuccessSchema.parse(
      (await request(app.getHttpServer()).post('/messages').send(multiOfferMessage).expect(200)).body,
    );
    const later = messageSuccessSchema.parse(
      (await request(app.getHttpServer())
        .post('/messages')
        .send({ ...englishMessage, id: 'http-msg-003' })
        .expect(200)).body,
    );

    const all = await request(app.getHttpServer()).get('/listings').expect(200);
    expect(all.body.listings.map((listing: { id: string }) => listing.id)).toEqual([
      multi.listings[0].id,
      multi.listings[1].id,
      later.listings[0].id,
    ]);
    expect(all.body.listings).toEqual([
      multi.listings[0],
      multi.listings[1],
      later.listings[0],
    ].map((listing) => ({ ...listing, approval_note: null })));

    const flagged = await request(app.getHttpServer()).get('/listings?needs_review=true').expect(200);
    expect(flagged.body.listings).toEqual([{ ...multi.listings[1], approval_note: null }]);

    const clear = await request(app.getHttpServer()).get('/listings?needs_review=false').expect(200);
    expect(clear.body.listings).toEqual([
      { ...multi.listings[0], approval_note: null },
      { ...later.listings[0], approval_note: null },
    ]);

    for (const query of ['needs_review=yes', 'needs_review=True', 'needs_review=true&needs_review=false']) {
      const invalid = await request(app.getHttpServer()).get(`/listings?${query}`).expect(400);
      expect(processingFailureSchema.parse(invalid.body)).toEqual({
        message_id: null,
        error: { code: 'invalid_input', message: 'Invalid needs_review filter' },
      });
    }

    await app.close();
    activeApps = [];
    const restarted = await createTestHttpApp({ execute: jest.fn() });
    const afterRestart = await request(restarted.getHttpServer()).get('/listings').expect(200);
    expect(afterRestart.body.listings).toEqual(all.body.listings);
  });

  it('approves flagged listings with an optional note while preserving snapshots and the first decision', async () => {
    const execute = jest.fn(async (request: { sourceText: string }) => ({
      classification: 'listing',
      detected_classes: ['listing'],
      listings: [request.sourceText.includes('Villa') ? englishOffer : arabicOffer],
    }));
    const app = await createTestHttpApp({ execute });
    const database = app.get(DatabaseService);
    const ingest = async (id: string) => messageSuccessSchema.parse(
      (await request(app.getHttpServer())
        .post('/messages')
        .send({ ...arabicMessage, id })
        .expect(200)).body,
    );

    const noNote = await ingest('approval-no-note');
    const noNoteApproved = await request(app.getHttpServer())
      .post(`/listings/${noNote.listings[0].id}/approve`)
      .expect(200);
    expect(listingResultSchema.parse(noNoteApproved.body)).toEqual({
      ...noNote.listings[0],
      needs_review: false,
      approval_note: null,
    });
    expect(noNoteApproved.body).toMatchObject({ approval_note: null });
    expect(noNoteApproved.body).not.toHaveProperty('approvedAt');
    const noNoteStored = await database.storedListing.findUniqueOrThrow({ where: { id: noNote.listings[0].id } });
    expect(noNoteStored).toMatchObject({ needsReview: false, approvalState: 'approved', approvalNote: null });
    expect(noNoteStored.approvedAt).not.toBeNull();

    const withNote = await ingest('approval-with-note');
    const firstApproval = await request(app.getHttpServer())
      .post(`/listings/${withNote.listings[0].id}/approve`)
      .send({ note: '  Reviewed incomplete details and accepted as-is.  ' })
      .expect(200);
    const firstStored = await database.storedListing.findUniqueOrThrow({ where: { id: withNote.listings[0].id } });
    expect(firstStored.approvalNote).toBe('Reviewed incomplete details and accepted as-is.');
    expect(firstStored.approvedAt).not.toBeNull();
    expect(firstApproval.body).toMatchObject({ approval_note: 'Reviewed incomplete details and accepted as-is.' });

    const repeated = await request(app.getHttpServer())
      .post(`/listings/${withNote.listings[0].id}/approve`)
      .send({ note: 'A later note must not replace the original.' })
      .expect(200);
    expect(repeated.body).toEqual(firstApproval.body);
    const repeatedStored = await database.storedListing.findUniqueOrThrow({ where: { id: withNote.listings[0].id } });
    expect(repeatedStored.approvalNote).toBe(firstStored.approvalNote);
    expect(repeatedStored.approvedAt).toEqual(firstStored.approvedAt);

    const empty = await ingest('approval-empty-note');
    await request(app.getHttpServer())
      .post(`/listings/${empty.listings[0].id}/approve`)
      .send({ note: '   ' })
      .expect(200);
    expect((await database.storedListing.findUniqueOrThrow({ where: { id: empty.listings[0].id } })).approvalNote).toBeNull();

    const blank = await ingest('approval-blank-note');
    await request(app.getHttpServer())
      .post(`/listings/${blank.listings[0].id}/approve`)
      .send({ note: '' })
      .expect(200);
    expect((await database.storedListing.findUniqueOrThrow({ where: { id: blank.listings[0].id } })).approvalNote).toBeNull();

    const invalid = await ingest('approval-invalid-note');
    for (const body of [{ note: 7 }, { note: 'x'.repeat(1001) }, { note: 'valid', extra: true }]) {
      const response = await request(app.getHttpServer())
        .post(`/listings/${invalid.listings[0].id}/approve`)
        .send(body)
        .expect(400);
      expect(processingFailureSchema.parse(response.body)).toEqual({
        message_id: null,
        error: { code: 'invalid_input', message: 'Invalid approval request' },
      });
    }
    const malformed = await request(app.getHttpServer())
      .post(`/listings/${invalid.listings[0].id}/approve`)
      .set('Content-Type', 'application/json')
      .send('{invalid-json')
      .expect(400);
    expect(processingFailureSchema.parse(malformed.body)).toEqual({
      message_id: null,
      error: { code: 'invalid_input', message: 'Invalid JSON body' },
    });
    expect(await database.storedListing.findUniqueOrThrow({ where: { id: invalid.listings[0].id } })).toMatchObject({
      needsReview: true,
      approvalState: 'pending',
      approvalNote: null,
    });

    const neverFlagged = await request(app.getHttpServer())
      .post('/messages')
      .send(englishMessage)
      .expect(200);
    const neverFlaggedId = messageSuccessSchema.parse(neverFlagged.body).listings[0].id;
    const conflict = await request(app.getHttpServer())
      .post(`/listings/${neverFlaggedId}/approve`)
      .send({})
      .expect(409);
    expect(processingFailureSchema.parse(conflict.body).error.code).toBe('approval_conflict');

    const missing = await request(app.getHttpServer())
      .post('/listings/missing-listing/approve')
      .send({})
      .expect(404);
    expect(processingFailureSchema.parse(missing.body).error.code).toBe('listing_not_found');

    const concurrent = await ingest('approval-concurrent');
    const [concurrentA, concurrentB] = await Promise.all([
      request(app.getHttpServer()).post(`/listings/${concurrent.listings[0].id}/approve`).send({ note: 'first candidate' }),
      request(app.getHttpServer()).post(`/listings/${concurrent.listings[0].id}/approve`).send({ note: 'second candidate' }),
    ]);
    expect([concurrentA.status, concurrentB.status]).toEqual([200, 200]);
    expect(concurrentA.body).toEqual(concurrentB.body);
    const concurrentStored = await database.storedListing.findUniqueOrThrow({ where: { id: concurrent.listings[0].id } });
    expect(['first candidate', 'second candidate']).toContain(concurrentStored.approvalNote);
    expect(concurrentStored.approvedAt).not.toBeNull();

    const flagged = await request(app.getHttpServer()).get('/listings?needs_review=true').expect(200);
    expect(flagged.body.listings.map((listing: { id: string }) => listing.id)).toEqual([invalid.listings[0].id]);
    const clear = await request(app.getHttpServer()).get('/listings?needs_review=false').expect(200);
    expect(clear.body.listings.find((listing: { id: string }) => listing.id === withNote.listings[0].id))
      .toMatchObject({ approval_note: 'Reviewed incomplete details and accepted as-is.' });
    expect(clear.body.listings.find((listing: { id: string }) => listing.id === noNote.listings[0].id))
      .toMatchObject({ approval_note: null });
    expect(clear.body.listings.map((listing: { id: string }) => listing.id)).toEqual([
      noNote.listings[0].id,
      withNote.listings[0].id,
      empty.listings[0].id,
      blank.listings[0].id,
      neverFlaggedId,
      concurrent.listings[0].id,
    ]);

    await app.close();
    activeApps = [];
    const restarted = await createTestHttpApp({ execute: jest.fn() });
    const afterRestart = await request(restarted.getHttpServer()).get('/listings?needs_review=false').expect(200);
    expect(afterRestart.body.listings).toEqual(clear.body.listings);
    const replay = await request(restarted.getHttpServer())
      .post('/messages')
      .send({ ...arabicMessage, id: withNote.message_id })
      .expect(200);
    const replayResult = messageSuccessSchema.parse(replay.body);
    expect(replayResult.listings).toEqual(withNote.listings);
    expect(replayResult.listings[0].needs_review).toBe(true);
  });
});
