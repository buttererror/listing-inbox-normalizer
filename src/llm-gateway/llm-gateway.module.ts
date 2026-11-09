import { Module } from '@nestjs/common';
import { loadConfig } from '../config/env';
import { GeminiGateway } from './gemini.gateway';
import { LLM_GATEWAY, LlmGateway, ProviderError } from './llm-request';

export const unconfiguredGateway: LlmGateway = {
  async execute() {
    throw new ProviderError('provider_unavailable', 'Extraction is not configured');
  },
};

@Module({
  providers: [
    {
      provide: LLM_GATEWAY,
      useFactory: () => {
        const config = loadConfig();
        if (config.LLM_PROVIDER !== 'gemini' || !config.GEMINI_API_KEY) return unconfiguredGateway;
        return new GeminiGateway({
          apiKey: config.GEMINI_API_KEY,
          model: config.LLM_MODEL,
          timeoutMs: 45000,
        });
      },
    },
  ],
  exports: [LLM_GATEWAY],
})
export class LlmGatewayModule {}

