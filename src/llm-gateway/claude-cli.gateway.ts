import { parseCliJsonResponseString, runCliCommand } from './cli-process';
import { LlmGateway, LlmRequest, ProviderError, writeLlmTelemetry } from './llm-request';

export interface ClaudeCliGatewayOptions {
  executable?: string;
  model?: string;
  timeoutMs?: number;
}

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

function extractClaudeUsage(envelope: Record<string, unknown>): TokenUsage | undefined {
  const rawUsage = envelope.usage;
  if (!rawUsage || typeof rawUsage !== 'object') return undefined;
  const usage = rawUsage as Record<string, unknown>;

  const baseInput = typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined;
  const cacheCreation = typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0;
  const cacheRead = typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0;
  const hasInput =
    baseInput !== undefined ||
    typeof usage.cache_creation_input_tokens === 'number' ||
    typeof usage.cache_read_input_tokens === 'number';

  const inputTokens = hasInput ? (baseInput ?? 0) + cacheCreation + cacheRead : undefined;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined;
  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined;

  return {
    ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
    ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
    ...(totalTokens !== undefined ? { total_tokens: totalTokens } : {}),
  };
}

function resolveClaudeModelName(configuredModel: string | undefined, envelope?: Record<string, unknown>): string {
  if (configuredModel) return configuredModel;
  const modelUsage = envelope?.modelUsage;
  if (modelUsage && typeof modelUsage === 'object') {
    const firstModel = Object.keys(modelUsage)[0];
    if (firstModel) return firstModel;
  }
  return 'default';
}

function extractCliErrorDetail(envelope: Record<string, unknown>): string {
  if (Array.isArray(envelope.errors)) {
    const firstError = envelope.errors.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    if (firstError) return firstError.trim().slice(0, 200);
  }
  if (typeof envelope.result === 'string' && envelope.result.trim().length > 0 && envelope.result.trim().length <= 200) {
    return envelope.result.trim();
  }
  if (typeof envelope.subtype === 'string' && envelope.subtype.trim().length > 0) {
    return envelope.subtype.trim();
  }
  return 'execution failed';
}

/**
 * Executes extraction via the local Anthropic Claude Code CLI (`claude`) in
 * non-interactive tool-less print mode with JSON schema enforcement.
 */
export class ClaudeCliGateway implements LlmGateway {
  private readonly executable: string;
  private readonly model?: string;
  private readonly timeoutMs: number;

  constructor(options?: ClaudeCliGatewayOptions) {
    this.executable = options?.executable ?? 'claude';
    this.model = options?.model;
    this.timeoutMs = options?.timeoutMs ?? 45000;
  }

  async execute(request: LlmRequest): Promise<unknown> {
    const startedAt = performance.now();
    const args = [
      '-p',
      'Analyze the source message provided via stdin and output JSON adhering to the schema.',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(request.responseSchema),
      '--system-prompt',
      request.instructions,
      '--tools',
      '',
      '--strict-mcp-config',
      '--disable-slash-commands',
      '--no-session-persistence',
    ];

    if (this.model) {
      args.push('--model', this.model);
    }

    const report = (
      usage?: TokenUsage,
      errorCode?: ProviderError['code'],
      durationMs?: number,
      modelName?: string,
    ) => {
      writeLlmTelemetry({
        ...(request.messageId ? { message_id: request.messageId } : {}),
        provider: 'claude-cli',
        model: modelName ?? this.model ?? 'default',
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
        providerLabel: 'claude CLI',
        stdin: `Source text:\n${request.sourceText}`,
      }));
    } catch (error) {
      if (error instanceof ProviderError) {
        report(undefined, error.code);
      }
      throw error;
    }

    let parsedEnvelope: unknown;
    try {
      parsedEnvelope = JSON.parse(stdout);
    } catch {
      report(undefined, 'provider_unavailable');
      throw new ProviderError('provider_unavailable', 'Failed to parse claude CLI output');
    }

    if (!parsedEnvelope || typeof parsedEnvelope !== 'object' || Array.isArray(parsedEnvelope)) {
      report(undefined, 'provider_unavailable');
      throw new ProviderError('provider_unavailable', 'Failed to parse claude CLI output');
    }

    const envelope = parsedEnvelope as Record<string, unknown>;
    const usage = extractClaudeUsage(envelope);
    const durationMs =
      typeof envelope.duration_ms === 'number' ? Math.round(envelope.duration_ms * 100) / 100 : undefined;
    const modelName = resolveClaudeModelName(this.model, envelope);

    const hasStructuredOutput =
      'structured_output' in envelope &&
      envelope.structured_output !== undefined &&
      envelope.structured_output !== null;

    if (envelope.subtype === 'error_max_structured_output_retries' && !hasStructuredOutput) {
      report(usage, undefined, durationMs, modelName);
      return undefined;
    }

    if (envelope.is_error === true) {
      report(usage, 'provider_unavailable', durationMs, modelName);
      throw new ProviderError('provider_unavailable', `claude CLI error: ${extractCliErrorDetail(envelope)}`);
    }

    report(usage, undefined, durationMs, modelName);

    if (hasStructuredOutput) {
      return envelope.structured_output;
    }
    if (typeof envelope.result === 'string' && envelope.result.trim().length > 0) {
      return parseCliJsonResponseString(envelope.result);
    }
    return parsedEnvelope;
  }
}
