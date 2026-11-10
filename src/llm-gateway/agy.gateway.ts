import { parseCliJsonResponseString, runCliCommand } from './cli-process';
import { LlmGateway, LlmRequest, ProviderError, writeLlmTelemetry } from './llm-request';

export interface AgyGatewayOptions {
  executable?: string;
  model?: string;
  timeoutMs?: number;
}

export const parseAgyResponseString = parseCliJsonResponseString;

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
      '--sandbox',
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

    let stdout: string;
    try {
      ({ stdout } = await runCliCommand({
        executable: this.executable,
        args,
        timeoutMs: this.timeoutMs,
        providerLabel: 'agy CLI',
      }));
    } catch (error) {
      if (error instanceof ProviderError) {
        report(undefined, error.code);
      }
      throw error;
    }

    try {
      const parsedEnvelope = JSON.parse(stdout);
      const usage = parsedEnvelope?.usage;
      const durationSeconds = parsedEnvelope?.duration_seconds;
      const durationMs =
        typeof durationSeconds === 'number'
          ? Math.round(durationSeconds * 1000 * 100) / 100
          : Math.round((performance.now() - startedAt) * 100) / 100;

      report(usage, undefined, durationMs);

      // Check for structured_output or parse response string
      if (parsedEnvelope && typeof parsedEnvelope === 'object') {
        if ('structured_output' in parsedEnvelope && parsedEnvelope.structured_output !== undefined) {
          return parsedEnvelope.structured_output;
        }
        if ('response' in parsedEnvelope && typeof parsedEnvelope.response === 'string') {
          return parseCliJsonResponseString(parsedEnvelope.response);
        }
      }
      return parsedEnvelope;
    } catch {
      report(undefined, 'provider_unavailable');
      throw new ProviderError('provider_unavailable', 'Failed to parse agy output');
    }
  }
}
