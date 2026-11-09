/** Provider-independent input for structured model execution. */
export interface LlmRequest {
  instructions: string;
  sourceText: string;
  responseSchema: Record<string, unknown>;
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

