import { spawn } from 'node:child_process';
import { LlmGateway, LlmRequest, ProviderError, writeLlmTelemetry } from './llm-request';

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
    const startedAt = performance.now();
    const prompt = `${request.instructions}\n\nSource text:\n${request.sourceText}`;
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

      const child = spawn(this.executable, ['--sandbox', ...args]);

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
              try {
                return resolve(JSON.parse(parsedEnvelope.response));
              } catch {
                return resolve(parsedEnvelope.response);
              }
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
