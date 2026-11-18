import { z } from "zod";
import { providerIdSchema } from "./reservation-shared";

const evidenceSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("gmail_api_send_message_v1"),
  reservationId: z.uuid(),
  accountId: z
    .string()
    .min(1)
    .max(256)
    .refine(
      (value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value),
    ),
  connectionId: z.uuid(),
  googleSubject: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value),
    ),
  grantEpoch: z.number().int().positive(),
  rfcMessageId: z
    .string()
    .min(3)
    .max(998)
    .regex(/^<[^\s<>]+>$/),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  providerMessageId: providerIdSchema,
  providerThreadId: providerIdSchema,
});
export type DirectSubmissionEvidence = z.infer<typeof evidenceSchema>;

export function matchesDirectSubmissionEvidence(
  value: unknown,
  expected: unknown,
): value is DirectSubmissionEvidence {
  const actual = evidenceSchema.safeParse(value);
  const target = evidenceSchema.safeParse(expected);
  if (!actual.success || !target.success) return false;
  return (
    actual.data.reservationId === target.data.reservationId &&
    actual.data.accountId === target.data.accountId &&
    actual.data.connectionId === target.data.connectionId &&
    actual.data.googleSubject === target.data.googleSubject &&
    actual.data.grantEpoch === target.data.grantEpoch &&
    actual.data.rfcMessageId === target.data.rfcMessageId &&
    actual.data.rawSha256 === target.data.rawSha256 &&
    actual.data.providerMessageId === target.data.providerMessageId &&
    actual.data.providerThreadId === target.data.providerThreadId
  );
}
