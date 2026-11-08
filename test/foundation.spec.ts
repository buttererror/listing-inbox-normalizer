import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createApplicationContext, createHttpApplication } from '../src/bootstrap';

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
});
