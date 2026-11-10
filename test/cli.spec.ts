import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createApplicationContext } from '../src/bootstrap';
import { createCliContext, runCli } from '../src/cli';
import { MessageProcessor } from '../src/messages/message-processor';

const message = {
  id: 'm-001', sender: '+966551234567', received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh.',
};

describe('process command', () => {
  let directory: string;
  let path: string;
  let stdout: string;
  let stderr: string;
  let closed: boolean;
  const processor: MessageProcessor = {
    async process(input) {
      return { message_id: input.id, classification: 'listing', listings: [] };
    },
  };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'listing-cli-'));
    path = join(directory, 'messages.jsonl');
    stdout = '';
    stderr = '';
    closed = false;
  });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  const dependencies = () => ({
    createContext: async () => {
      const app = await createApplicationContext({ logger: false });
      return { getProcessor: () => processor, close: async () => { await app.close(); closed = true; } };
    },
    stdout: (text: string) => { stdout += text; },
    stderr: (text: string) => { stderr += text; },
  });

  it('processes a local file using a context without opening an HTTP listener', async () => {
    await writeFile(path, `${JSON.stringify(message)}\n{bad\n${JSON.stringify({ ...message, id: 'm-002' })}\n`);
    const listen = jest.spyOn(createServer().constructor.prototype, 'listen');
    try {
      expect(await runCli(['process', path], dependencies())).toBe(1);
      expect(stdout.trim().split('\n').map((line) => JSON.parse(line))).toEqual([
        { message_id: 'm-001', classification: 'listing', listings: [] },
        { message_id: null, error: { code: 'invalid_input', message: 'Invalid JSONL record' } },
        { message_id: 'm-002', classification: 'listing', listings: [] },
      ]);
      expect(stderr).toBe('');
      expect(closed).toBe(true);
      expect(listen).not.toHaveBeenCalled();
    } finally { listen.mockRestore(); }
  });

  it('returns zero for a successful file and closes the context', async () => {
    await writeFile(path, JSON.stringify(message));
    expect(await runCli(['process', path], dependencies())).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ message_id: 'm-001', classification: 'listing', listings: [] });
    expect(stderr).toBe('');
    expect(closed).toBe(true);
  });

  it('reports argument and file errors on stderr without opening a context', async () => {
    const createContext = jest.fn(dependencies().createContext);
    const deps = { ...dependencies(), createContext };
    expect(await runCli(['process'], deps)).toBe(1);
    expect(await runCli(['process', path], deps)).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('Usage:');
    expect(stderr).toContain('Unable to read input file');
    expect(createContext).not.toHaveBeenCalled();
  });

  it('closes the context when processor lookup fails', async () => {
    await writeFile(path, JSON.stringify(message));
    const deps = dependencies();
    const createContext = deps.createContext;
    deps.createContext = async () => ({ ...await createContext(), getProcessor: () => { throw new Error('failure'); } });
    expect(await runCli(['process', path], deps)).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('Unable to run message processing');
    expect(closed).toBe(true);
  });

  it('runs the production entry point with an unavailable provider failure without opening SQLite', async () => {
    await writeFile(path, JSON.stringify(message));
    const originalKey = process.env.LLM_API_KEY;
    const originalProvider = process.env.LLM_PROVIDER;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const missingDbDir = join(directory, 'nonexistent-sqlite-dir');
    process.env.LLM_PROVIDER = 'gemini';
    process.env.LLM_API_KEY = '';
    process.env.DATABASE_URL = `file:${join(missingDbDir, 'cli.db')}`;
    try {
      expect(await runCli(['process', path], { ...dependencies(), createContext: createCliContext })).toBe(1);
      expect(existsSync(missingDbDir)).toBe(false);
    } finally {
      if (originalKey === undefined) delete process.env.LLM_API_KEY;
      else process.env.LLM_API_KEY = originalKey;
      if (originalProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = originalProvider;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toEqual({
      message_id: 'm-001', error: { code: 'provider_unavailable', message: 'Extraction is not configured' },
    });
  });
});
