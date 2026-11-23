import { z } from "zod";

const resendEvidenceSchema = z
  .strictObject({
    version: z.literal(1),
    kind: z.literal("resend_api_send_email_v1"),
    reservationId: z.uuid(),
    accountId: z.uuid(),
    connectionId: z.uuid(),
    sendGeneration: z.uuid(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_/-]{1,256}$/),
    bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
    providerMessageId: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
  })
  .refine((evidence) => evidence.accountId === evidence.connectionId);

export type ResendSubmissionEvidence = z.infer<typeof resendEvidenceSchema>;

export function matchesResendSubmissionEvidence(
  value: unknown,
  expected: unknown,
): value is ResendSubmissionEvidence {
  const actual = resendEvidenceSchema.safeParse(value);
  const target = resendEvidenceSchema.safeParse(expected);
  if (!actual.success || !target.success) return false;
  return (
    actual.data.reservationId === target.data.reservationId &&
    actual.data.accountId === target.data.accountId &&
    actual.data.connectionId === target.data.connectionId &&
    actual.data.sendGeneration === target.data.sendGeneration &&
    actual.data.idempotencyKey === target.data.idempotencyKey &&
    actual.data.bodySha256 === target.data.bodySha256 &&
    actual.data.providerMessageId === target.data.providerMessageId
  );
}
