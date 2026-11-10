import * as childProcess from 'node:child_process';
import os from 'node:os';
import { ProviderError } from './llm-request';

export interface RunCliCommandOptions {
  executable: string;
  args: string[];
  timeoutMs: number;
  providerLabel: string;
  cwd?: string;
  stdin?: string;
}

export interface CliCommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute a CLI provider subprocess in an isolated temporary directory with
 * deterministic timeout enforcement and typed ProviderError mapping.
 */
export function runCliCommand(options: RunCliCommandOptions): Promise<CliCommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const spawnOptions: childProcess.SpawnOptions = {
      cwd: options.cwd ?? os.tmpdir(),
      windowsHide: true,
      ...(options.stdin !== undefined ? { stdio: ['pipe', 'pipe', 'pipe'] } : {}),
    };

    const child = childProcess.spawn(options.executable, options.args, spawnOptions);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);

    child.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer | string) => {
      stderr += data.toString();
    });

    if (options.stdin !== undefined && child.stdin) {
      // Prevent unhandled EPIPE if the child fails or closes before reading stdin.
      child.stdin.on('error', () => {});
      child.stdin.end(options.stdin);
    }

    child.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProviderError('provider_unavailable', `Failed to execute ${options.providerLabel}: ${err.message}`));
    });

    child.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timedOut) {
        return reject(new ProviderError('provider_timeout', 'Provider timed out'));
      }
      if (code !== 0) {
        return reject(
          new ProviderError(
            'provider_unavailable',
            `${options.providerLabel} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
          ),
        );
      }
      resolve({ stdout, stderr });
    });
  });
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

/** Extract structured JSON from raw text, fenced code blocks, or multi-line JSON responses. */
export function parseCliJsonResponseString(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const parsedObjects: unknown[] = [];

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
