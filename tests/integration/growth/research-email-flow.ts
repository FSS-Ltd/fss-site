import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  app: GrowthDb,
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
    reviewedRecipient: review.data.reviewedRecipient,
    fingerprint: review.data.approvalFingerprint!,
    permission: {
      basis: "consent" as const,
      evidence: "Recipient requested this specific information.",
    },
    founder,
    correlationId: `${prefix}-approve`,
  };
  await assert.rejects(
    approve(app, {
      ...input,
      expectedVersion: 1,
      fingerprint: original.data.approvalFingerprint!,
    }),
  );
  const approved = await approve(app, input);
  const [approvalSnapshot] = await sql<
    Array<{
      snapshot: {
        reviewedRecipient: typeof input.reviewedRecipient;
        effectiveRecipient: typeof input.reviewedRecipient;
        approvedRecipient: string;
      };
      contactVersion: number;
      prospectVersion: number;
    }>
  >`
    select se.template_snapshot as snapshot, c.version as "contactVersion", p.version as "prospectVersion"
    from growth.sequence_enrollments se join growth.contacts c on c.id = se.contact_id
    join growth.prospects p on p.id = se.prospect_id where se.id = ${approved.sequenceEnrollmentId}
  `;
  assert.ok(approvalSnapshot);
  assert.deepEqual(
    approvalSnapshot.snapshot.reviewedRecipient,
    input.reviewedRecipient,
  );
  assert.equal(
    approvalSnapshot.snapshot.approvedRecipient,
    input.reviewedRecipient.email,
  );
  assert.deepEqual(approvalSnapshot.snapshot.effectiveRecipient, {
    ...input.reviewedRecipient,
    contactVersion: approvalSnapshot.contactVersion,
    prospectVersion: approvalSnapshot.prospectVersion,
  });
  assert.equal(
    approvalSnapshot.contactVersion,
    input.reviewedRecipient.contactVersion + 1,
  );
  assert.equal(
    approvalSnapshot.prospectVersion,
    input.reviewedRecipient.prospectVersion + 1,
  );
  await assert.rejects(approve(app, input));

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
  const otherApproved = await approve(app, {
    ...input,
    draftTaskId: other.id,
    expectedVersion: otherReview.data.version,
    expectedProspectVersion: otherReview.data.prospectVersion,
    reviewedRecipient: otherReview.data.reviewedRecipient,
    fingerprint: otherReview.data.approvalFingerprint!,
    correlationId: `${prefix}-other`,
  });
  // A held account must not call the provider, even for a targeted approval.
  const dispatch = createOutreachDispatcher({
    repository: postgresSequenceDispatchRepository,
    bound:
      {} as import("../../../lib/growth/integrations/gmail/live-client").BoundGmailClient,
    refreshUsage: async () => ({ status: "held", reason: "usage_unknown" }),
    reserve: async () => ({ status: "held", reason: "unused" }),
    submit: async () => ({ status: "held", reason: "unused" }),
    confirm: async () => ({ status: "held", reason: "unused" }),
  });
  const held = await dispatch(sql, new Date(), approved.messageId);
  assert.equal(held.held, 1);
  const [stored] = await sql<{ status: string; html: string; text: string }[]>`
    select status,html_snapshot as html,text_snapshot as text from growth.email_messages where id=${approved.messageId}`;
  assert.equal(stored?.status, "queued");
  assert.equal(stored?.text, review.data.previewText);
  assert.equal(stored?.html, review.data.previewHtml);
  const [pending] = await sql<
    { status: string }[]
  >`select status from growth.email_messages where id=${otherApproved.messageId}`;
  assert.equal(pending?.status, "queued");
  // Historical sent fixture for the separate reply-routing assertions below.
  await sql`update growth.email_messages set status='sent',provider_message_id=${`mock-send-${prefix}`},provider_thread_id=${`mock-thread-${prefix}`},rfc_message_id=${`<mock-${prefix}@example.test>`},sent_at=now() where id=${approved.messageId}`;
  await sql`update growth.sequence_enrollments set gmail_thread_id=${`mock-thread-${prefix}`} where id=${approved.sequenceEnrollmentId}`;
  const replyMessageId = `reply-${prefix}`;
  const threadId = `mock-thread-${prefix}`;
  const connectionId = randomUUID();
  const syncEmail = `${connectionId}@example.test`;
  await sql`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${connectionId},'gmail',${syncEmail},'connected','test-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
  try {
    const sync = createGmailReplySync({
      repository: {
        ...postgresGmailSyncRepository,
        loadReplySyncState: async () => ({
          cursor: "100",
          historyCursor: "100",
          coverageId: "coverage",
          observedUntil: new Date("2026-01-01T00:00:00Z"),
        }),
        commitReplyCoverage: async () => "coverage-next",
      },
      founderEmail: syncEmail,
      binding: {
        connectionId,
        googleSubject: "test-subject",
        grantEpoch: 1,
        grantedScopes: [
          "openid",
          "email",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
      },
      createCorrelationId: () => `${prefix}-reply`,
      gmailClient: {
        getProfile: async () => ({
          emailAddress: syncEmail,
          historyId: "101",
        }),
        listHistory: async () => ({
          historyId: "101",
          records: [
            {
              historyId: "101",
              messagesAdded: [
                { messageId: replyMessageId, gmailThreadId: threadId },
              ],
              messagesDeleted: [],
            },
          ],
        }),
        getMessageMetadata: async () => ({
          messageId: replyMessageId,
          gmailThreadId: threadId,
          historyId: "101",
          labelIds: ["INBOX"],
          receivedAt: new Date().toISOString(),
          from: review.data.contactEmail,
          subject: "Re: The reviewed subject",
          rfcMessageId: `<${replyMessageId}@example.test>`,
          autoSubmitted: null,
          precedence: null,
          returnPath: null,
          autoResponseSuppress: null,
          to: null,
          cc: null,
          bcc: null,
          inReplyTo: null,
          references: null,
        }),
      },
    });
    assert.equal((await sync(sql)).replies, 0);
    const [conversation] = await sql<
      { status: string }[]
    >`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
    assert.equal(conversation?.status, "paused");
  } finally {
    await sql`delete from growth.integration_connections where id=${connectionId}`;
  }
}
