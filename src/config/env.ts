import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

function normalizeEnvInput(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
}

function resolveDefaultCliExecutable(
  env: NodeJS.ProcessEnv,
  envKey: 'AGY_EXECUTABLE' | 'CLAUDE_EXECUTABLE',
  binaryName: string,
): string {
  const configured = normalizeEnvInput(env[envKey]);
  if (typeof configured === 'string') {
    return configured;
  }
  const home =
    (normalizeEnvInput(env.HOME) as string | undefined) ??
    (normalizeEnvInput(env.USERPROFILE) as string | undefined) ??
    os.homedir();
  if (home) {
    const candidates = process.platform === 'win32' ? [`${binaryName}.exe`, binaryName] : [binaryName];
    for (const candidateName of candidates) {
      const candidate = path.join(home, '.local', 'bin', candidateName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return binaryName;
}

const optionalNonEmptyString = z.preprocess(normalizeEnvInput, z.string().min(1).optional());

function createSchema(env: NodeJS.ProcessEnv) {
  return z.object({
    PORT: z.preprocess(normalizeEnvInput, z.coerce.number().int().min(1).max(65535).default(3000)),
    DATABASE_URL: z.preprocess(normalizeEnvInput, z.string().min(1).default('file:./dev.db')),
    LLM_PROVIDER: z.preprocess(
      normalizeEnvInput,
      z.enum(['gemini', 'anthropic', 'openai', 'antigravity', 'agy', 'claude-cli', 'claude']).default('gemini'),
    ),
    AGY_EXECUTABLE: z.preprocess(
      normalizeEnvInput,
      z.string().min(1).default(() => resolveDefaultCliExecutable(env, 'AGY_EXECUTABLE', 'agy')),
    ),
    CLAUDE_EXECUTABLE: z.preprocess(
      normalizeEnvInput,
      z.string().min(1).default(() => resolveDefaultCliExecutable(env, 'CLAUDE_EXECUTABLE', 'claude')),
    ),
    LLM_MODEL: optionalNonEmptyString,
    LLM_TIMEOUT_MS: z.preprocess(normalizeEnvInput, z.coerce.number().int().positive().default(45000)),
    LLM_API_KEY: optionalNonEmptyString,
  });
}

export type AppConfig = z.infer<ReturnType<typeof createSchema>>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return createSchema(env).parse(env);
}
