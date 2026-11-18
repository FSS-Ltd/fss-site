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

export const transitionUsageSchema = z.strictObject({
  id: z.string().trim().min(1).max(255),
  transitionId: z.string().trim().min(1).max(600),
  internalDate: z.iso.datetime(),
  observedUpperBound: z.iso.datetime(),
  recipientFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  recipientCount: z.number().int().positive(),
});

export function validTransitionUsageProvenance(
  value: unknown,
  messages: number | null,
  recipients: number | null,
  cutoff: Date,
  now: Date,
): boolean {
  const parsed = z.array(transitionUsageSchema).max(1000).safeParse(value);
  if (
    !parsed.success ||
    !Number.isFinite(cutoff.getTime()) ||
    !Number.isFinite(now.getTime()) ||
    cutoff > now ||
    parsed.data.length !== messages ||
    recipients === null ||
    !Number.isSafeInteger(recipients)
  )
    return false;
  const transitions = new Set<string>();
  let total = 0;
  for (const entry of parsed.data) {
    const upper = Date.parse(entry.observedUpperBound);
    const internalDate = Date.parse(entry.internalDate);
    if (
      transitions.has(entry.transitionId) ||
      upper > now.getTime() ||
      upper <= cutoff.getTime() - 86400000 ||
      internalDate > upper
    )
      return false;
    transitions.add(entry.transitionId);
    total += entry.recipientCount;
    if (!Number.isSafeInteger(total)) return false;
  }
  return total === recipients;
}
