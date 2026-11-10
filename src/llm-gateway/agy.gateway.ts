import { spawn } from 'node:child_process';
import os from 'node:os';
import { LlmGateway, LlmRequest, ProviderError, writeLlmTelemetry } from './llm-request';

export interface AgyGatewayOptions {
  executable?: string;
  model?: string;
  timeoutMs?: number;
}

function hasValidCandidateShapes(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  if (typeof record.classification !== 'string' || !Array.isArray(record.listings)) {
    return false;
  }
  for (const listing of record.listings) {
    if (!listing || typeof listing !== 'object') return false;
    const candidates = (listing as Record<string, unknown>).candidates;
    if (!Array.isArray(candidates)) return false;
    for (const c of candidates) {
      if (!c || typeof c !== 'object') return false;
      const cand = c as Record<string, unknown>;
      if (!('field' in cand) || !('value' in cand) || !('quote' in cand) || !('scope' in cand)) {
        return false;
      }
    }
  }
  return true;
}

export function parseAgyResponseString(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const parsedObjects: unknown[] = [];

  // Extract from any markdown code blocks ```json ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(trimmed)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        parsedObjects.push(parsed);
      }
    } catch {}
  }

  // Extract from individual JSON lines
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{') && l.endsWith('}'));
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') {
        parsedObjects.push(parsed);
      }
    } catch {}
  }

  if (parsedObjects.length > 0) {
    const valid = parsedObjects.find(hasValidCandidateShapes);
    return valid ?? parsedObjects[0];
  }

  return raw;
}

export class AgyGateway implements LlmGateway {
  private readonly executable: string;
  private readonly model?: string;
  private readonly timeoutMs: number;

  constructor(options?: AgyGatewayOptions) {
    this.executable = options?.executable ?? 'agy';
    this.model = options?.model;
    this.timeoutMs = options?.timeoutMs ?? 45000;
  }

  async execute(request: LlmRequest): Promise<unknown> {
    const startedAt = performance.now();
    const prompt = `${request.instructions}\nIMPORTANT: Do not execute any commands or call any tools. Output ONLY valid JSON adhering to the schema.\n\nSource text:\n${request.sourceText}`;
    const args = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(request.responseSchema),
      '--disable-slash-commands',
    ];

    if (this.model) {
      args.push('--model', this.model);
    }

    const report = (
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number },
      errorCode?: ProviderError['code'],
      durationMs?: number,
    ) => {
      writeLlmTelemetry({
        ...(request.messageId ? { message_id: request.messageId } : {}),
        provider: 'agy',
        model: this.model ?? 'default',
        duration_ms: durationMs ?? Math.round((performance.now() - startedAt) * 100) / 100,
        ...(usage?.input_tokens !== undefined ? { input_tokens: usage.input_tokens } : {}),
        ...(usage?.output_tokens !== undefined ? { output_tokens: usage.output_tokens } : {}),
        ...(usage?.total_tokens !== undefined ? { total_tokens: usage.total_tokens } : {}),
        ...(errorCode ? { error_code: errorCode } : {}),
      });
    };

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(this.executable, ['--sandbox', ...args], { cwd: os.tmpdir() });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, this.timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        report(undefined, 'provider_unavailable');
        reject(new ProviderError('provider_unavailable', `Failed to execute agy CLI: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          report(undefined, 'provider_timeout');
          return reject(new ProviderError('provider_timeout', 'Provider timed out'));
        }
        if (code !== 0) {
          report(undefined, 'provider_unavailable');
          return reject(
            new ProviderError(
              'provider_unavailable',
              `agy CLI exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
            ),
          );
        }

        try {
          const parsedEnvelope = JSON.parse(stdout);
          const usage = parsedEnvelope?.usage;
          const durationSeconds = parsedEnvelope?.duration_seconds;
          const durationMs = typeof durationSeconds === 'number'
            ? Math.round(durationSeconds * 1000 * 100) / 100
            : Math.round((performance.now() - startedAt) * 100) / 100;

          report(usage, undefined, durationMs);

          // Check for structured_output or parse response string
          if (parsedEnvelope && typeof parsedEnvelope === 'object') {
            if ('structured_output' in parsedEnvelope && parsedEnvelope.structured_output !== undefined) {
              return resolve(parsedEnvelope.structured_output);
            }
            if ('response' in parsedEnvelope && typeof parsedEnvelope.response === 'string') {
              return resolve(parseAgyResponseString(parsedEnvelope.response));
            }
          }
          resolve(parsedEnvelope);
        } catch {
          report(undefined, 'provider_unavailable');
          reject(new ProviderError('provider_unavailable', 'Failed to parse agy output'));
        }
      });
    });
  }
}
