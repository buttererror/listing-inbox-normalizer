import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplicationContext } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.service';
import { ExtractionService } from '../src/extraction/extraction.service';
import { OfferValidationOutcome } from '../src/extraction/stage2-mechanical-validation';
import { ListingsService } from '../src/listings/listings.service';
import { ListingMessageProcessor } from '../src/messages/listing-message-processor';
import { PersistentIngestionService } from '../src/messages/persistent-ingestion.service';
import { RawMessage } from '../src/messages/raw-message.schema';

const message: RawMessage = {
  id: 'persist-replay-001',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'Villa in Riyadh',
};

function deploy(databaseUrl: string): void {
  execFileSync('pnpm', ['--silent', 'run', 'db:deploy'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe',
  });
}

function offer(index: number): OfferValidationOutcome {
  return {
    offer_index: index,
    offer_quote: `Offer ${index + 1}`,
    acceptedCandidates: [{ field: 'city', value: 'Riyadh', quote: 'Riyadh', scope: 'local' }],
    rejectedCandidates: [], semanticFindings: [], rejectedFindings: [], validationFindings: [],
  };
}

describe('Phase 04.2 persistence and replay', () => {
  let directory: string;
  let originalDatabaseUrl: string | undefined;
  let app: Awaited<ReturnType<typeof createApplicationContext>>;
  let database: DatabaseService;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'listing-replay-'));
    const databaseUrl = `file:${join(directory, 'phase04.db')}`;
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = databaseUrl;
    deploy(databaseUrl);
    app = await createApplicationContext({ logger: false });
    database = app.get(DatabaseService);
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    rmSync(directory, { recursive: true, force: true });
  });

  function processor(extract: jest.Mock, ids = ['listing-1', 'listing-2']): PersistentIngestionService {
    let index = 0;
    const shared = new ListingMessageProcessor(
      { extract } as unknown as ExtractionService,
      new ListingsService(),
      () => ids[index++] ?? `listing-${index}`,
    );
    return new PersistentIngestionService(shared, database);
  }

  it('persists successful multi-offer output and replays the immutable snapshot without a gateway call', async () => {
    const extract = jest.fn().mockResolvedValue({
      ok: true,
      result: { classification: 'listing', detected_classes: ['listing'], offers: [offer(0), offer(1)] },
    });
    const subject = processor(extract);

    const first = await subject.ingest(message);
    const replay = await subject.ingest(message);

    expect(replay).toEqual(first);
    expect(extract).toHaveBeenCalledTimes(1);
    const stored = await database.storedMessage.findUniqueOrThrow({
      where: { id: message.id }, include: { listings: { orderBy: { offerIndex: 'asc' } } },
    });
    expect(stored.listings.map((listing) => listing.id)).toEqual(['listing-1', 'listing-2']);
    expect(JSON.parse(stored.resultSnapshot)).toEqual(first);
  });

  it('returns a conflict for changed original fields and retains the winner', async () => {
    const extract = jest.fn().mockResolvedValue({
      ok: true,
      result: { classification: 'project', detected_classes: ['project'], offers: [] },
    });
    const subject = processor(extract);
    await subject.ingest(message);

    await expect(subject.ingest({ ...message, text: 'Changed text' })).resolves.toEqual({
      message_id: message.id,
      error: { code: 'message_conflict', message: 'Message ID conflicts with an existing message' },
    });
    expect(extract).toHaveBeenCalledTimes(1);
    expect(await database.storedMessage.count()).toBe(1);
  });

  it('keeps one winner for concurrent identical writes and returns its snapshot', async () => {
    const extract = jest.fn().mockResolvedValue({
      ok: true,
      result: { classification: 'project', detected_classes: ['project'], offers: [] },
    });
    const [first, second] = await Promise.all([
      processor(extract).ingest(message),
      processor(extract).ingest(message),
    ]);

    expect(first).toEqual(second);
    expect(await database.storedMessage.count()).toBe(1);
  });

  it('leaves no successful message after extraction failure or an atomic write failure', async () => {
    const failure = processor(jest.fn().mockResolvedValue({
      ok: false,
      failure: { message_id: message.id, error: { code: 'provider_unavailable', message: 'Unavailable' } },
    }));
    await expect(failure.ingest(message)).resolves.toMatchObject({ error: { code: 'provider_unavailable' } });
    expect(await database.storedMessage.count()).toBe(0);

    const writeFailure = processor(jest.fn().mockResolvedValue({
      ok: true,
      result: { classification: 'listing', detected_classes: ['listing'], offers: [offer(0), offer(1)] },
    }), ['duplicate-id', 'duplicate-id']);
    await expect(writeFailure.ingest({ ...message, id: 'persist-write-failure' })).rejects.toBeDefined();
    expect(await database.storedMessage.count()).toBe(0);
    expect(await database.storedListing.count()).toBe(0);
  });
});
