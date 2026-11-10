import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createApplicationContext, createHttpApplication } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.service';

function deployMigrations(databaseUrl: string): void {
  execFileSync('pnpm', ['--silent', 'run', 'db:deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

describe('foundation', () => {
  it('serves liveness and closes the HTTP application', async () => {
    const app = await createHttpApplication();
    await app.init();
    try { await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' }); }
    finally { await app.close(); }
  });
  it('starts and closes a non-HTTP application context', async () => {
    const app = await createApplicationContext();
    await app.close();
  });
  it('opens, queries and closes a disposable SQLite database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'listing-sqlite-'));
    try {
      const db = new Database(join(dir, 'test.db'));
      try { expect(db.prepare('SELECT 1 AS value').get()).toEqual({ value: 1 }); }
      finally { db.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('applies migrations and preserves listing state after restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'listing-persistence-'));
    const databaseUrl = `file:${join(dir, 'phase04.db')}`;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = databaseUrl;

    try {
      deployMigrations(databaseUrl);
      const firstApp = await createApplicationContext({ logger: false });
      try {
        const database = firstApp.get(DatabaseService);
        await database.storedMessage.create({
          data: {
            id: 'm-persist-001',
            sender: '+966551234567',
            receivedAt: '2026-11-01T09:12:00+03:00',
            text: 'Villa in Riyadh',
            classification: 'listing',
            detectedClasses: '["listing"]',
            resultSnapshot: '{"message_id":"m-persist-001","listings":[]}',
            listings: {
              create: [
                {
                  id: 'listing-persist-001',
                  offerIndex: 0,
                  priceCurrency: 'SAR',
                  needsReview: true,
                  originallyNeedsReview: true,
                  reviewReasons: '["price_missing"]',
                  provenance: '{}',
                },
                {
                  id: 'listing-persist-002',
                  offerIndex: 1,
                  priceCurrency: 'SAR',
                  needsReview: false,
                  originallyNeedsReview: false,
                  reviewReasons: '[]',
                  provenance: '{}',
                },
              ],
            },
          },
        });
      } finally {
        await firstApp.close();
      }

      const restartedApp = await createHttpApplication();
      await restartedApp.init();
      try {
        const database = restartedApp.get(DatabaseService);
        const message = await database.storedMessage.findUniqueOrThrow({
          where: { id: 'm-persist-001' },
          include: { listings: { orderBy: { offerIndex: 'asc' } } },
        });

        expect(message.listings.map((listing) => listing.id)).toEqual([
          'listing-persist-001',
          'listing-persist-002',
        ]);
        expect(message.listings[0].needsReview).toBe(true);
        expect(message.listings[1].needsReview).toBe(false);
      } finally {
        await restartedApp.close();
      }
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
