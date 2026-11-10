import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config/env';

describe('env config (loadConfig)', () => {
  let emptyHomeDir: string;

  beforeEach(() => {
    emptyHomeDir = mkdtempSync(join(tmpdir(), 'dwelleo-env-home-'));
  });

  afterEach(() => {
    rmSync(emptyHomeDir, { recursive: true, force: true });
  });

  it('applies expected defaults when environment variables are unset', () => {
    const config = loadConfig({ HOME: emptyHomeDir, USERPROFILE: emptyHomeDir });
    expect(config).toEqual({
      PORT: 3000,
      DATABASE_URL: 'file:./dev.db',
      LLM_PROVIDER: 'gemini',
      AGY_EXECUTABLE: 'agy',
      CLAUDE_EXECUTABLE: 'claude',
      LLM_MODEL: undefined,
      LLM_TIMEOUT_MS: 45000,
      LLM_API_KEY: undefined,
    });
  });

  it('treats blank and whitespace-only strings as unset rather than crashing or coercing to zero', () => {
    const config = loadConfig({
      HOME: emptyHomeDir,
      USERPROFILE: emptyHomeDir,
      PORT: '',
      DATABASE_URL: '   ',
      LLM_PROVIDER: ' ',
      AGY_EXECUTABLE: '',
      CLAUDE_EXECUTABLE: '   ',
      LLM_MODEL: '',
      LLM_TIMEOUT_MS: '  ',
      LLM_API_KEY: '   ',
    });
    expect(config).toEqual({
      PORT: 3000,
      DATABASE_URL: 'file:./dev.db',
      LLM_PROVIDER: 'gemini',
      AGY_EXECUTABLE: 'agy',
      CLAUDE_EXECUTABLE: 'claude',
      LLM_MODEL: undefined,
      LLM_TIMEOUT_MS: 45000,
      LLM_API_KEY: undefined,
    });
  });

  it.each(['claude-cli', 'claude', 'agy', 'antigravity', 'gemini', 'anthropic', 'openai'] as const)(
    'accepts supported LLM_PROVIDER %s',
    (provider) => {
      const config = loadConfig({
        HOME: emptyHomeDir,
        USERPROFILE: emptyHomeDir,
        LLM_PROVIDER: provider,
      });
      expect(config.LLM_PROVIDER).toBe(provider);
    },
  );

  it('rejects invalid port, timeout, and unknown provider values', () => {
    expect(() => loadConfig({ HOME: emptyHomeDir, PORT: '0' })).toThrow();
    expect(() => loadConfig({ HOME: emptyHomeDir, PORT: '70000' })).toThrow();
    expect(() => loadConfig({ HOME: emptyHomeDir, LLM_TIMEOUT_MS: '0' })).toThrow();
    expect(() => loadConfig({ HOME: emptyHomeDir, LLM_TIMEOUT_MS: '-5' })).toThrow();
    expect(() => loadConfig({ HOME: emptyHomeDir, LLM_PROVIDER: 'unknown' })).toThrow();
  });

  it('prefers explicit CLAUDE_EXECUTABLE and otherwise discovers ~/.local/bin/claude when present', () => {
    const explicit = loadConfig({
      HOME: emptyHomeDir,
      USERPROFILE: emptyHomeDir,
      CLAUDE_EXECUTABLE: '  /custom/bin/claude  ',
    });
    expect(explicit.CLAUDE_EXECUTABLE).toBe('/custom/bin/claude');

    const localBinDir = join(emptyHomeDir, '.local', 'bin');
    mkdirSync(localBinDir, { recursive: true });
    const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude';
    const expectedPath = join(localBinDir, binaryName);
    writeFileSync(expectedPath, '');

    const discovered = loadConfig({
      HOME: emptyHomeDir,
      USERPROFILE: emptyHomeDir,
    });
    expect(discovered.CLAUDE_EXECUTABLE).toBe(expectedPath);
  });
});
