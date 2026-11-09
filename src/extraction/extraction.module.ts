import { Module } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { LlmGatewayModule } from '../llm-gateway/llm-gateway.module';

@Module({
  imports: [LlmGatewayModule],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}

