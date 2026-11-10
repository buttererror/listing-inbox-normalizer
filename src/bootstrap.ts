import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/env';
import { ExtractionModule } from './extraction/extraction.module';
import { ListingsModule } from './listings/listings.module';
import { LlmGatewayModule } from './llm-gateway/llm-gateway.module';
import { ListingMessageProcessor } from './messages/listing-message-processor';
import { MESSAGE_PROCESSOR } from './messages/message-processor';

@Module({
  imports: [LlmGatewayModule, ExtractionModule, ListingsModule],
  providers: [
    ListingMessageProcessor,
    { provide: MESSAGE_PROCESSOR, useExisting: ListingMessageProcessor },
  ],
  exports: [MESSAGE_PROCESSOR, ListingMessageProcessor, ExtractionModule, ListingsModule],
})
class CliAppModule {}

export async function createApplicationContext(options?: { logger: false }) {
  loadConfig();
  return NestFactory.createApplicationContext(AppModule, { ...options, abortOnError: false });
}
export async function createCliApplicationContext(options?: { logger: false }) {
  loadConfig();
  return NestFactory.createApplicationContext(CliAppModule, { ...options, abortOnError: false });
}
export async function createHttpApplication(options?: { logger: false }) {
  loadConfig();
  return NestFactory.create(AppModule, options);
}
