import { z } from "zod";

const messageSchema = z.strictObject({
  id: z.string().trim().min(1).max(255),
  sentAt: z.iso.datetime(),
  recipientCount: z.number().int().positive(),
});
const usageMessagesSchema = z.array(messageSchema).max(1000);

export function validUsageProvenance(
  value: unknown,
  messages: number | null,
  recipients: number | null,
  capturedAt: Date,
): boolean {
  const parsed = usageMessagesSchema.safeParse(value);
  if (
    !parsed.success ||
    !Number.isFinite(capturedAt.getTime()) ||
    parsed.data.length !== messages ||
    !Number.isSafeInteger(recipients) ||
    recipients === null
  )
    return false;
  const ids = new Set<string>();
  let total = 0;
  for (const message of parsed.data) {
    const sentAt = Date.parse(message.sentAt);
    if (
      ids.has(message.id) ||
      sentAt > capturedAt.getTime() ||
      sentAt <= capturedAt.getTime() - 24 * 60 * 60 * 1000
    )
      return false;
    ids.add(message.id);
    total += message.recipientCount;
    if (!Number.isSafeInteger(total)) return false;
  }
  return total === recipients;
}
