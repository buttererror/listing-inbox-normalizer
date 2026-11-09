import { z } from 'zod';

/** Input shared by all message ingestion transports. */
export const rawMessageSchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1),
  received_at: z.iso.datetime({ offset: true }),
  text: z.string().min(1),
});

export type RawMessage = z.infer<typeof rawMessageSchema>;
