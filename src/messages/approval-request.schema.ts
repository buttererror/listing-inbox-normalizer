import { z } from 'zod';

export const approvalRequestSchema = z.object({
  note: z.string().optional(),
}).strict().transform(({ note }) => {
  const trimmed = note?.trim();
  return { note: trimmed || undefined };
}).refine(
  ({ note }) => note === undefined || note.length <= 1000,
  { message: 'Approval note must not exceed 1000 characters', path: ['note'] },
);

export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
