import { spawn } from 'node:child_process';
import { LlmGateway, LlmRequest, ProviderError } from './llm-request';

export interface AgyGatewayOptions {
  executable?: string;
  model?: string;
  timeoutMs?: number;
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
    const prompt = `${request.instructions}\n\nSource text:\n${request.sourceText}`;
    const args = [
      '--dangerously-skip-permissions',
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

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(this.executable, args);

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
        reject(new ProviderError('provider_unavailable', `Failed to execute agy CLI: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          return reject(new ProviderError('provider_timeout', 'Provider timed out'));
        }
        if (code !== 0) {
          return reject(
            new ProviderError(
              'provider_unavailable',
              `agy CLI exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
            ),
          );
        }

        try {
          const parsedEnvelope = JSON.parse(stdout);
          // Check for structured_output or parse response string
          if (parsedEnvelope && typeof parsedEnvelope === 'object') {
            if ('structured_output' in parsedEnvelope && parsedEnvelope.structured_output !== undefined) {
              return resolve(parsedEnvelope.structured_output);
            }
            if ('response' in parsedEnvelope && typeof parsedEnvelope.response === 'string') {
              try {
                return resolve(JSON.parse(parsedEnvelope.response));
              } catch {
                return resolve(parsedEnvelope.response);
              }
            }
          }
          resolve(parsedEnvelope);
        } catch {
          reject(new ProviderError('provider_unavailable', 'Failed to parse agy output'));
        }
      });
    });
  }
}
