import assert from "node:assert/strict";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { getMessageReview } from "../../../lib/growth/dashboard/message-review";
import { reviseFirstEmailDraft } from "../../../lib/growth/sequences/first-email-revisions";
import { createResearchEmailApprover } from "../../../lib/growth/sequences/research-email-approval";
import { postgresFirstEmailApprovalRepository } from "../../../lib/growth/sequences/approval-repository";
import { createOutreachDispatcher } from "../../../lib/growth/sequences/dispatcher";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";

export async function verifyResearchEmailFlow(
  sql: GrowthDb,
  draftTaskId: string,
  prefix: string,
): Promise<void> {
  const founder = { email: "founder@example.test", actorId: "a".repeat(64) };
  const original = await getMessageReview(
    draftTaskId,
    founder.email,
    "https://example.test",
    sql,
  );
  assert.equal(original.status, "ready");
  const paragraphs = [
    "A booking portal could help your team.",
    "Reply unsubscribe if this is not useful.",
  ];
  await reviseFirstEmailDraft(sql, {
    draftTaskId,
    expectedVersion: 1,
    founder,
    correlationId: `${prefix}-edit`,
    subject: "The reviewed subject",
    paragraphs,
  });
  const review = await getMessageReview(
    draftTaskId,
    founder.email,
    "https://example.test",
    sql,
  );
  assert.equal(review.status, "ready");
  assert.equal(review.data.version, 2);
  assert.equal(review.data.previewText, paragraphs.join("\n\n"));
  const approve = createResearchEmailApprover({
    repository: postgresFirstEmailApprovalRepository,
    founderEmail: founder.email,
  });
  const input = {
    draftTaskId,
    expectedVersion: 2,
    expectedProspectVersion: review.data.prospectVersion,
    fingerprint: review.data.approvalFingerprint!,
    permission: {
      basis: "consent" as const,
      evidence: "Recipient requested this specific information.",
    },
    founder,
    correlationId: `${prefix}-approve`,
  };
  await assert.rejects(
    approve(sql, {
      ...input,
      expectedVersion: 1,
      fingerprint: original.data.approvalFingerprint!,
    }),
  );
  const approved = await approve(sql, input);
  await assert.rejects(approve(sql, input));

  // Keep another due record present: targeted delivery must not send it.
  const [other] = await sql<
    { id: string }[]
  >`select id from growth.agent_tasks where prospect_id in (select id from growth.prospects where business_id in (select id from growth.businesses where legal_name = ${`${prefix}-source-only`}))`;
  assert.ok(other);
  const otherReview = await getMessageReview(
    other.id,
    founder.email,
    "https://example.test",
    sql,
  );
  assert.equal(otherReview.status, "ready");
  const otherApproved = await approve(sql, {
    ...input,
    draftTaskId: other.id,
    expectedVersion: otherReview.data.version,
    expectedProspectVersion: otherReview.data.prospectVersion,
    fingerprint: otherReview.data.approvalFingerprint!,
    correlationId: `${prefix}-other`,
  });
  const sentRaw: string[] = [];
  const dispatch = createOutreachDispatcher({
    repository: postgresSequenceDispatchRepository,
    founderEmail: founder.email,
    maxMessagesPerRun: 1,
    gmailClient: {
      sendMessage: async ({ raw }) => {
        sentRaw.push(raw);
        return {
          messageId: `mock-send-${prefix}`,
          gmailThreadId: `mock-thread-${prefix}`,
        };
      },
      findByRfcMessageId: async () => null,
    },
  });
  const sent = await dispatch(sql, new Date(), approved.messageId);
  assert.equal(
    sent.sent,
    1,
    JSON.stringify({
      summary: sent,
      rows: await sql`select status,last_error_code,last_error_summary from growth.email_messages where id=${approved.messageId}`,
    }),
  );
  assert.equal(sentRaw.length, 1);
  const [stored] = await sql<
    {
      status: string;
      html: string;
      text: string;
      enrollmentStatus: string;
      followUps: number;
    }[]
  >`
    select em.status, em.html_snapshot as html, em.text_snapshot as text, se.status as "enrollmentStatus",
      (select count(*)::int from growth.email_messages where sequence_enrollment_id = se.id and step_number > 0) as "followUps"
    from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id where em.id=${approved.messageId}`;
  assert.equal(stored?.status, "sent");
  assert.equal(stored?.text, review.data.previewText);
  assert.equal(stored?.html, review.data.previewHtml);
  assert.equal(stored?.enrollmentStatus, "completed");
  assert.equal(stored?.followUps, 0);
  const [pending] = await sql<
    { status: string }[]
  >`select status from growth.email_messages where id=${otherApproved.messageId}`;
  assert.equal(pending?.status, "queued");
  assert.equal((await dispatch(sql, new Date(), approved.messageId)).sent, 0);
  assert.equal(sentRaw.length, 1);
}
