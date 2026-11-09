import { LlmGateway, LlmRequest, ProviderError } from './llm-request';
import { z } from 'zod';

const responseSchema = z.object({
  candidates: z.array(z.object({
    finishReason: z.literal('STOP'),
    content: z.object({ parts: z.array(z.object({ text: z.string() })).min(1) }),
  })).min(1),
});

const supportedSchemaKeys = new Set([
  '$id', '$defs', '$ref', '$anchor', 'type', 'format', 'title', 'description',
  'enum', 'items', 'prefixItems', 'minItems', 'maxItems', 'minimum', 'maximum',
  'anyOf', 'oneOf', 'properties', 'additionalProperties', 'required',
]);

function geminiSchema(value: unknown, propertyMap = false): unknown {
  if (Array.isArray(value)) return value.map((item) => geminiSchema(item));
  if (typeof value !== 'object' || value === null) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (propertyMap) result[key] = geminiSchema(item);
    else if (key === 'const') result.enum = [item];
    else if (supportedSchemaKeys.has(key)) {
      result[key] = geminiSchema(item, key === 'properties' || key === '$defs');
    }
  }
  return result;
}

export interface GeminiOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class GeminiGateway implements LlmGateway {
  constructor(private readonly options: GeminiOptions) {}

  async execute(request: LlmRequest): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
          encodeURIComponent(this.options.model) + ':generateContent',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.options.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.instructions }] },
            contents: [{ role: 'user', parts: [{ text: request.sourceText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: geminiSchema(request.responseSchema),
            },
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new ProviderError('provider_unavailable', 'Provider request failed');

      let envelope: unknown;
      try {
        envelope = await response.json();
      } catch {
        if (controller.signal.aborted) throw new ProviderError('provider_timeout', 'Provider timed out');
        return undefined;
      }
      const parsed = responseSchema.safeParse(envelope);
      if (!parsed.success) return undefined;
      const parts = parsed.data.candidates[0].content.parts;
      try {
        return JSON.parse(parts.map((part) => part.text).join(''));
      } catch {
        return undefined;
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new ProviderError('provider_timeout', 'Provider timed out');
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('provider_unavailable', 'Provider request failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
