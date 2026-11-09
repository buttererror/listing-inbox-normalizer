import { Module } from '@nestjs/common';
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
      useValue: unconfiguredGateway,
    },
  ],
  exports: [LLM_GATEWAY],
})
export class LlmGatewayModule {}

