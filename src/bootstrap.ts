import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/env';

export async function createApplicationContext() {
  loadConfig();
  return NestFactory.createApplicationContext(AppModule);
}
export async function createHttpApplication() {
  loadConfig();
  return NestFactory.create(AppModule);
}
