import { Controller, Get, Module } from '@nestjs/common';
import { MessagesModule } from './messages/messages.module';
import { ExtractionModule } from './extraction/extraction.module';
import { ListingsModule } from './listings/listings.module';
import { LlmGatewayModule } from './llm-gateway/llm-gateway.module';
import { DatabaseModule } from './database/database.module';

@Controller()
export class HealthController {
  @Get('health')
  health() { return { status: 'ok' }; }
}

@Module({ imports: [MessagesModule, ExtractionModule, ListingsModule, LlmGatewayModule, DatabaseModule], controllers: [HealthController] })
export class AppModule {}
