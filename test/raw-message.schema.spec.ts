import { rawMessageSchema } from '../src/messages/raw-message.schema';

const message = {
  id: 'm-001',
  sender: '+966551234567',
  received_at: '2026-11-01T09:12:00+03:00',
  text: 'For sale: Villa in Riyadh. Asking 3.2M SAR.',
};

describe('rawMessageSchema', () => {
  it('preserves the four original values and discards extra keys', () => {
    expect(rawMessageSchema.parse({ ...message, debug: true })).toEqual(message);
  });

  it.each(['id', 'sender', 'received_at', 'text'] as const)(
    'rejects a missing, non-string or empty %s',
    (field) => {
      const missing: Partial<typeof message> = { ...message };
      delete missing[field];
      expect(rawMessageSchema.safeParse(missing).success).toBe(false);
      expect(rawMessageSchema.safeParse({ ...message, [field]: 1 }).success).toBe(false);
      expect(rawMessageSchema.safeParse({ ...message, [field]: '' }).success).toBe(false);
    },
  );

  it.each(['yesterday', '2026-11-01T09:12:00', '2026-02-30T09:12:00Z'])(
    'rejects invalid or timezone-free timestamps: %s',
    (received_at) => {
      expect(rawMessageSchema.safeParse({ ...message, received_at }).success).toBe(false);
    },
  );

  it('accepts UTC timestamps without changing their representation', () => {
    const received_at = '2026-11-01T06:12:00Z';
    expect(rawMessageSchema.parse({ ...message, received_at }).received_at).toBe(received_at);
  });
});
