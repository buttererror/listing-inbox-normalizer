/** Provider-independent input for structured model execution. */
export interface LlmRequest {
  instructions: string;
  sourceText: string;
  responseSchema: Record<string, unknown>;
}

export interface LlmGateway {
  execute(request: LlmRequest): Promise<unknown>;
}
