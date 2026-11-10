import type * as AiSdk from 'ai';
import { ProviderError, writeLlmTelemetry } from './llm-request';
import type { LlmGateway, LlmRequest } from './llm-request';

type LanguageModel = Parameters<typeof AiSdk.generateText>[0]['model'];
type SupportedProvider = 'gemini' | 'anthropic' | 'openai';

export interface AiSdkGatewayOptions {
  provider: SupportedProvider;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class AiSdkGateway implements LlmGateway {
  private constructor(
    private readonly model: LanguageModel,
    private readonly options: AiSdkGatewayOptions,
  ) {}

  static async create(options: AiSdkGatewayOptions): Promise<AiSdkGateway> {
    try {
      if (options.provider === 'gemini') {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        return new AiSdkGateway(createGoogleGenerativeAI({ apiKey: options.apiKey })(options.model), options);
      }
      if (options.provider === 'anthropic') {
        const { createAnthropic } = await import('@ai-sdk/anthropic');
        return new AiSdkGateway(createAnthropic({ apiKey: options.apiKey })(options.model), options);
      }
      const { createOpenAI } = await import('@ai-sdk/openai');
      return new AiSdkGateway(createOpenAI({ apiKey: options.apiKey }).chat(options.model), options);
    } catch {
      throw new ProviderError('provider_unavailable', 'Provider request failed');
    }
  }

  async execute(request: LlmRequest): Promise<unknown> {
    const startedAt = performance.now();
    const report = (usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }, errorCode?: ProviderError['code']) => {
      writeLlmTelemetry({
        ...(request.messageId ? { message_id: request.messageId } : {}),
        provider: this.options.provider,
        model: this.options.model,
        duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
        ...(usage?.inputTokens !== undefined ? { input_tokens: usage.inputTokens } : {}),
        ...(usage?.outputTokens !== undefined ? { output_tokens: usage.outputTokens } : {}),
        ...(usage?.totalTokens !== undefined ? { total_tokens: usage.totalTokens } : {}),
        ...(errorCode ? { error_code: errorCode } : {}),
      });
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    let noObjectGeneratedError: { isInstance(error: unknown): boolean } | undefined;
    try {
      const { generateText, jsonSchema, NoObjectGeneratedError, Output } = await import('ai');
      noObjectGeneratedError = NoObjectGeneratedError;
      const result = await generateText({
        model: this.model,
        system: request.instructions,
        prompt: request.sourceText,
        output: Output.object({ schema: jsonSchema(request.responseSchema) }),
        maxRetries: 0,
        abortSignal: controller.signal,
        ...(this.options.provider === 'anthropic'
          ? { providerOptions: { anthropic: { structuredOutputMode: 'outputFormat' } } }
          : {}),
      });
      report(result.usage);
      return result.output;
    } catch (error) {
      if (controller.signal.aborted) {
        report(undefined, 'provider_timeout');
        throw new ProviderError('provider_timeout', 'Provider timed out');
      }
      if (noObjectGeneratedError?.isInstance(error)) {
        report();
        return undefined;
      }
      report(undefined, 'provider_unavailable');
      throw new ProviderError('provider_unavailable', 'Provider request failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
