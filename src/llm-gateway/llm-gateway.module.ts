import { Module } from '@nestjs/common';
import { loadConfig } from '../config/env';
import type { AppConfig } from '../config/env';
import { AgyGateway } from './agy.gateway';
import { AiSdkGateway } from './ai-sdk.gateway';
import { ClaudeCliGateway } from './claude-cli.gateway';
import { LLM_GATEWAY, ProviderError } from './llm-request';
import type { LlmGateway } from './llm-request';

export const unconfiguredGateway: LlmGateway = {
  async execute() {
    throw new ProviderError('provider_unavailable', 'Extraction is not configured');
  },
};

export async function createLlmGateway(config: AppConfig = loadConfig()): Promise<LlmGateway> {
  if (config.LLM_PROVIDER === 'agy' || config.LLM_PROVIDER === 'antigravity') {
    return new AgyGateway({
      executable: config.AGY_EXECUTABLE,
      model: config.LLM_MODEL,
      timeoutMs: config.LLM_TIMEOUT_MS,
    });
  }
  if (config.LLM_PROVIDER === 'claude-cli' || config.LLM_PROVIDER === 'claude') {
    return new ClaudeCliGateway({
      executable: config.CLAUDE_EXECUTABLE,
      model: config.LLM_MODEL,
      timeoutMs: config.LLM_TIMEOUT_MS,
    });
  }
  if (config.LLM_PROVIDER === 'gemini' && config.LLM_API_KEY) {
    return AiSdkGateway.create({
      provider: 'gemini',
      apiKey: config.LLM_API_KEY,
      model: config.LLM_MODEL ?? 'gemini-3.6-flash',
      timeoutMs: config.LLM_TIMEOUT_MS,
    });
  }
  if (config.LLM_PROVIDER === 'anthropic' && config.LLM_API_KEY && config.LLM_MODEL) {
    return AiSdkGateway.create({
      provider: 'anthropic',
      apiKey: config.LLM_API_KEY,
      model: config.LLM_MODEL,
      timeoutMs: config.LLM_TIMEOUT_MS,
    });
  }
  if (config.LLM_PROVIDER === 'openai' && config.LLM_API_KEY && config.LLM_MODEL) {
    return AiSdkGateway.create({
      provider: 'openai',
      apiKey: config.LLM_API_KEY,
      model: config.LLM_MODEL,
      timeoutMs: config.LLM_TIMEOUT_MS,
    });
  }
  return unconfiguredGateway;
}

@Module({
  providers: [
    {
      provide: LLM_GATEWAY,
      useFactory: createLlmGateway,
    },
  ],
  exports: [LLM_GATEWAY],
})
export class LlmGatewayModule {}
