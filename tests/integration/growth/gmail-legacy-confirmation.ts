import assert from "node:assert/strict";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import type { GrowthDb } from "../../../lib/growth/db/types";
import type { GmailGrantBinding } from "../../../lib/growth/integrations/gmail/live-client";
import { scheduleFollowUps } from "../../../lib/growth/sequences/schedule";

export async function exerciseLegacyConfirmation(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    reservationId: string;
    sequenceId: string;
    messageId: string;
    contactEmail: string;
    email: string;
    binding: GmailGrantBinding;
    rfcMessageId: string;
  },
): Promise<void> {
  const providerCreatedAt = new Date().toISOString();
  const confirm = createGmailConfirmation(db, async () => ({
    binding: input.binding,
    client: {
      getProfile: async () => ({ emailAddress: input.email, historyId: "200" }),
      findByRfcMessageId: async () => ({
        messageId: "accepted-provider",
        gmailThreadId: "accepted-thread",
        historyId: "200",
        labelIds: ["SENT"],
        receivedAt: providerCreatedAt,
        from: input.email,
        to: input.contactEmail,
        cc: null,
        bcc: null,
        subject: "Second",
        rfcMessageId: input.rfcMessageId,
        autoSubmitted: null,
        precedence: null,
        returnPath: null,
        autoResponseSuppress: null,
        inReplyTo: null,
        references: null,
      }),
    },
  }));
  await admin`create function growth.test_legacy_confirmation_rollback() returns trigger language plpgsql as $$ begin if new.action='outreach_reservation.gmail_sent_observed' then raise exception 'legacy receipt rollback'; end if; return new; end $$`;
  await admin`create trigger test_legacy_confirmation_rollback before insert on growth.audit_log for each row execute function growth.test_legacy_confirmation_rollback()`;
  try {
    await assert.rejects(async () => {
      const attempt = await confirm(input.reservationId);
      if (attempt.status === "held")
        throw new Error(`confirmation held: ${attempt.reason}`);
    }, /legacy receipt rollback/);
    const [rolledBack] = await admin<{ receipt: unknown; followups: number }[]>`
      select r.confirmation_receipt as receipt,(select count(*)::int from growth.email_messages where sequence_enrollment_id=${input.sequenceId} and step_number in (1,3)) as followups
      from growth.outreach_reservations r where r.id=${input.reservationId}`;
    assert.equal(rolledBack?.receipt, null);
    assert.equal(rolledBack?.followups, 0);
  } finally {
    await admin`drop trigger test_legacy_confirmation_rollback on growth.audit_log`;
    await admin`drop function growth.test_legacy_confirmation_rollback()`;
  }
  const result = await confirm(input.reservationId);
  if (result.status !== "ready")
    throw new Error(`confirmation held: ${result.reason}`);
  assert.equal(result.value.coverageOrigin.kind, "bounded");
  const [origin] = await admin<{ submitted: Date; receiptOrigin: string }[]>`
    select submitted_at as submitted,confirmation_receipt->>'possibleInvocationFrom' as "receiptOrigin"
    from growth.outreach_reservations where id=${input.reservationId}`;
  assert.equal(origin?.receiptOrigin, origin?.submitted.toISOString());
  const scheduled = scheduleFollowUps(result.value.anchor.observedAt);
  const rows = await admin<{ step: number; scheduled: Date }[]>`
    select step_number as step,scheduled_for as scheduled from growth.email_messages where sequence_enrollment_id=${input.sequenceId} and step_number in (1,3) order by step_number`;
  assert.deepEqual(
    rows.map((row) => row.step),
    [1, 3],
  );
  assert.equal(rows[0]?.scheduled.getTime(), scheduled.day_5.getTime());
  assert.equal(rows[1]?.scheduled.getTime(), scheduled.day_14.getTime());
  const [message] = await admin<
    { sentAt: Date | null }[]
  >`select sent_at as "sentAt" from growth.email_messages where id=${input.messageId}`;
  assert.equal(message?.sentAt, null);
  assert.equal((await confirm(input.reservationId)).status, "ready");
  const [count] = await admin<
    { count: number }[]
  >`select count(*)::int as count from growth.email_messages where sequence_enrollment_id=${input.sequenceId} and step_number in (1,3)`;
  assert.equal(count?.count, 2);
}
