import { createHash } from "node:crypto";
import { z } from "zod";
import type { GrowthDb } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import { validateGmailSentObservation } from "../integrations/gmail/reconciliation";
import { parseGmailRecipients } from "../integrations/gmail/recipients";
import type { GmailClient } from "../integrations/gmail/types";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import { held, type ReservationOutcome } from "./reservation-shared";

const snapshotSchema = z.object({
  version: z.literal(1),
  kind: z.literal("direct_raw"),
  raw: z
    .string()
    .min(1)
    .max(4_000_000)
    .regex(/^[A-Za-z0-9_-]+$/),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  from: z.email(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  googleSubject: z.string().min(1),
  grantEpoch: z.number().int().positive(),
  messageId: z.uuid(),
  sequenceId: z.uuid(),
  membershipId: z.uuid().nullable(),
  gmailThreadId: z.string().nullable(),
  envelope: z.object({
    to: z.array(z.string()),
    cc: z.array(z.string()),
    bcc: z.array(z.string()),
  }),
});
export type VerifiedConfirmation = {
  reservationId: string;
  binding: GmailGrantBinding;
  observedFrom: Date;
  observedUntil: Date;
  providerCreatedAt: Date;
  providerMessageId: string;
  providerThreadId: string;
  rfcMessageId: string;
  rawSha256: string;
};

export type BoundReader = {
  binding: GmailGrantBinding;
  client: Pick<GmailClient, "getProfile" | "findByRfcMessageId">;
};
export async function observeGmailConfirmation(
  db: GrowthDb,
  resolve: () => Promise<BoundReader>,
  reservationId: string,
): Promise<ReservationOutcome<VerifiedConfirmation>> {
  if (!z.uuid().safeParse(reservationId).success) return held("invalid_input");
  const [initial] = await db<
    { snapshot: unknown; hash: string | null; status: string }[]
  >`
      select issued_snapshot as snapshot,issued_snapshot_hash as hash,status from growth.outreach_reservations where id=${reservationId}`;
  const parsed = snapshotSchema.safeParse(initial?.snapshot);
  if (
    !initial ||
    !parsed.success ||
    !["submitting", "uncertain", "accepted"].includes(initial.status)
  )
    return held("issued_attempt_unknown");
  const snapshot = parsed.data;
  if (
    snapshot.rawSha256 !== initial.hash ||
    createHash("sha256")
      .update(Buffer.from(snapshot.raw, "base64url"))
      .digest("hex") !== snapshot.rawSha256 ||
    Buffer.from(snapshot.raw, "base64url").toString("base64url") !==
      snapshot.raw
  )
    return held("issued_payload_invalid");
  const { client, binding } = await resolve();
  if (
    binding.connectionId !== snapshot.connectionId ||
    binding.googleSubject !== snapshot.googleSubject
  )
    return held("account_changed");
  const [start] = await db<{ at: Date }[]>`select clock_timestamp() as at`;
  if (!start || !Number.isFinite(start.at.getTime()))
    return held("observation_clock_invalid");
  const profile = await client.getProfile();
  const metadata = await client.findByRfcMessageId(snapshot.rfcMessageId);
  const [end] = await db<{ at: Date }[]>`select clock_timestamp() as at`;
  if (!end || !Number.isFinite(end.at.getTime()) || end.at < start.at)
    return held("observation_clock_invalid");
  const observation = validateGmailSentObservation({
    binding,
    currentBinding: binding,
    profile,
    expectedEmail: CAMPAIGN_FOUNDER_EMAIL,
    expectedRfcMessageId: snapshot.rfcMessageId,
    metadata,
    observedFrom: start.at,
    observedUntil: end.at,
  });
  if (observation.kind !== "observed" || !metadata)
    return held("sent_observation_unknown");
  if (
    snapshot.gmailThreadId &&
    snapshot.gmailThreadId !== observation.providerThreadId
  )
    return held("thread_changed");
  const sender = parseGmailRecipients({
    to: metadata.from,
    cc: null,
    bcc: null,
  });
  if (!sender || sender.to.length !== 1 || sender.to[0] !== snapshot.from)
    return held("sender_changed");
  const envelope = parseGmailRecipients(metadata);
  if (
    !envelope ||
    JSON.stringify(envelope) !== JSON.stringify(snapshot.envelope)
  )
    return held("recipient_changed");
  return {
    status: "ready",
    value: {
      reservationId,
      binding,
      observedFrom: start.at,
      observedUntil: end.at,
      providerCreatedAt: observation.providerCreatedAt,
      providerMessageId: observation.providerMessageId,
      providerThreadId: observation.providerThreadId,
      rfcMessageId: observation.rfcMessageId,
      rawSha256: snapshot.rawSha256,
    },
  };
}
