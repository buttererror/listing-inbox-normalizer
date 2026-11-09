import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  LLM_PROVIDER: z.enum(['gemini', 'antigravity']).default('gemini'),
  AGY_EXECUTABLE: z.string().min(1).default('agy'),
  LLM_MODEL: z.string().min(1).default('gemini-3.6-flash'),
  GEMINI_API_KEY: z.string().optional(),
});
export function loadConfig() { return schema.parse(process.env); }
