/** Provider-independent input for structured model execution. */
export interface LlmRequest {
  messageId?: string;
  instructions: string;
  sourceText: string;
  responseSchema: Record<string, unknown>;
}

export interface LlmExecutionTelemetry {
  message_id?: string;
  provider: string;
  model: string;
  duration_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  error_code?: ProviderError['code'];
}

export function writeLlmTelemetry(event: LlmExecutionTelemetry): void {
  if (process.env.DWELLEO_TELEMETRY === '1') {
    process.stderr.write(`DWELLEO_TELEMETRY ${JSON.stringify(event)}\n`);
  }
}

export interface LlmGateway {
  execute(request: LlmRequest): Promise<unknown>;
}

export const LLM_GATEWAY = Symbol('LLM_GATEWAY');

export class ProviderError extends Error {
  constructor(
    public readonly code: 'provider_unavailable' | 'provider_timeout',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

