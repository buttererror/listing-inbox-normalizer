import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/env';

export async function createApplicationContext(options?: { logger: false }) {
  loadConfig();
  return NestFactory.createApplicationContext(AppModule, { ...options, abortOnError: false });
}
export async function createHttpApplication() {
  loadConfig();
  return NestFactory.create(AppModule);
}
