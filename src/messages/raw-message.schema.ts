import { z } from 'zod';

/** Input shared by all message ingestion transports. */
export const rawMessageSchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1),
  received_at: z.iso.datetime({ offset: true }),
  text: z.string().min(1),
});

export type RawMessage = z.infer<typeof rawMessageSchema>;

/** Extract a candidate non-empty string message ID from unvalidated input for error reporting. */
export function extractCandidateMessageId(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('id' in input)) return null;
  const id = (input as { id: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
