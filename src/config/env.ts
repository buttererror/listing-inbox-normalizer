import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

function resolveDefaultAgyExecutable(): string {
  if (process.env.AGY_EXECUTABLE) {
    return process.env.AGY_EXECUTABLE;
  }
  const home = process.env.HOME;
  if (home) {
    const candidate = path.join(home, '.local', 'bin', 'agy');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'agy';
}

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  LLM_PROVIDER: z.enum(['gemini', 'anthropic', 'openai', 'antigravity', 'agy']).default('gemini'),
  AGY_EXECUTABLE: z.string().min(1).default(resolveDefaultAgyExecutable),
  LLM_MODEL: z.string().min(1).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  LLM_API_KEY: z.string().optional(),
});
export type AppConfig = z.infer<typeof schema>;
export function loadConfig() { return schema.parse(process.env); }
