import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";
import { Webhook } from "svix";

import { appendAuditEvent } from "../../../lib/growth/audit/service";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { signUnsubscribeToken } from "../../../lib/growth/email/suppression";
import type { ResendGateway } from "../../../lib/growth/integrations/resend/client";
import {
  handleResendWebhook,
  type ResendWebhookDependencies,
} from "../../../lib/growth/integrations/resend/webhook";
import { createPostgresResendWebhookRepository } from "../../../lib/growth/integrations/resend/webhook-repository";
import {
  submitLeadInTransaction,
  type SubmitLeadInput,
} from "../../../lib/growth/inbound/submit-lead";
import {
  createFounderTestSender,
  createIssueApprover,
  createIssueScheduler,
  createPostgresNewsletterIssueDependencies,
  UNSUBSCRIBE_URL_PLACEHOLDER,
} from "../../../lib/growth/newsletter/issues";
import { createNewsletterDispatcher } from "../../../lib/growth/newsletter/dispatch";
import { postgresNewsletterDispatchRepository } from "../../../lib/growth/newsletter/newsletter-dispatch-repository";
import {
  createNewsletterSubscriberRepository,
  upsertSuppressedStatus,
} from "../../../lib/growth/newsletter/subscribers-repository";
import type { StoppedSequence } from "../../../lib/growth/sequences/stop";
import { createUnsubscribeRouteHandler } from "../../../app/api/newsletter/unsubscribe/route";
import { renderEmail } from "../../../emails/render-email";
import { SiteEnquiryThankYou } from "../../../emails/site-enquiry-thank-you";

const connectionString = process.env.DIRECT_DATABASE_URL;

const UNSUBSCRIBE_TOKEN_SECRET = "e2e-unsubscribe-token-secret-32-chars!!";
const SITE_ORIGIN = "https://faithfulsoftwaresolutions.co.uk";
const FROM_EMAIL = "notifications@faithfulsoftwaresolutions.co.uk";
const REPLY_TO_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const FOUNDER: FounderSession = {
  email: "j.ntagengwa@faithfulsoftware.dev",
  actorId: "e2e-founder-actor",
};
const WEBHOOK_SECRET = Buffer.from("resend-marketing-flow-webhook-secret").toString("base64");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fakeResend(): { gateway: Pick<ResendGateway, "send">; sent: Parameters<ResendGateway["send"]>[0][] } {
  const sent: Parameters<ResendGateway["send"]>[0][] = [];
  return {
    sent,
    gateway: {
      send: async (message) => {
        sent.push(message);
        return { providerMessageId: `provider-${randomUUID()}` };
      },
    },
  };
}

function leadInput(overrides: Partial<SubmitLeadInput> = {}): SubmitLeadInput {
  return {
    submissionId: randomUUID(),
    submissionType: "site_enquiry",
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: `resend-flow-${randomUUID()}@example.test`,
    businessName: "Lovelace Systems",
    sourcePath: "/contact",
    sourceContext: "contact_form",
    newsletterOptIn: true,
    ...overrides,
  };
}

async function insertDraftIssue(
  sql: GrowthDb,
  overrides: { issueKey: string; status: string; scheduledFor?: Date },
): Promise<string> {
  const html = `<html><body><p>Field Notes</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Unsubscribe</a></body></html>`;
  const text = `Field Notes\nUnsubscribe: ${UNSUBSCRIBE_URL_PLACEHOLDER}`;
  const [row] = await sql<{ id: string }[]>`
    insert into growth.newsletter_issues (
      issue_key, status, subject, preview_text, html_snapshot, text_snapshot,
      created_by, scheduled_for
    ) values (
      ${overrides.issueKey}, ${overrides.status}, 'Field Notes #1', 'This week in Field Notes',
      ${html}, ${text}, 'e2e-test', ${overrides.scheduledFor ?? null}
    )
    returning id
  `;
  return row.id;
}

test(
  "the full Resend marketing slice chains form -> consent -> newsletter -> webhook -> unsubscribe",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 4 });
    const leadA = leadInput();
    const leadB = leadInput();
    const issueKeyA = `e2e-issue-a-${randomUUID()}`;
    const issueKeyB = `e2e-issue-b-${randomUUID()}`;
    let issueAId: string | undefined;
    let issueBId: string | undefined;

    try {
      // --- Step 1: form submission persists in PostgreSQL, is idempotent,
      // and the opt-in checkbox is the newsletter consent path. ---
      const firstSubmit = await submitLeadInTransaction(leadA, sql);
      assert.equal(firstSubmit.alreadySubmitted, false);
      const replaySubmit = await submitLeadInTransaction(leadA, sql);
      assert.equal(replaySubmit.alreadySubmitted, true);
      assert.equal(replaySubmit.leadId, firstSubmit.leadId);

      const [leadRowCount] = await sql<{ count: string }[]>`
        select count(*)::text as count from growth.inbound_leads where submission_id = ${leadA.submissionId}
      `;
      assert.equal(leadRowCount.count, "1", "a replayed submission does not duplicate the lead row");

      const [subscriberA] = await sql<{ status: string }[]>`
        select status from growth.newsletter_subscribers
        where normalised_email = ${leadA.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberA.status, "subscribed");

      // --- Step 1b: the requested-resource email template renders complete
      // HTML and plain text (exercised directly since the fire-and-forget
      // send in lib/server/lead-submission.ts is outside this transaction). ---
      const requestedEmail = await renderEmail({
        templateKey: "site-enquiry-thank-you",
        element: SiteEnquiryThankYou({ firstName: leadA.firstName, businessName: leadA.businessName }),
      });
      assert.match(requestedEmail.html, /We received your request/);
      assert.match(requestedEmail.html, new RegExp(leadA.businessName));
      assert.match(requestedEmail.text, new RegExp(leadA.firstName));
      assert.doesNotMatch(requestedEmail.text, /<[a-z][^>]*>/i);

      // --- Step 2: seed a newsletter_issues row directly (no authoring
      // service exists yet; see task-10-context.md). ---
      issueAId = await insertDraftIssue(sql, { issueKey: issueKeyA, status: "ready_for_review" });

      // --- Step 3: founder test send goes to the founder only, subscriber
      // state untouched. ---
      const founderTest = fakeResend();
      const issueRepository = createPostgresNewsletterIssueDependencies(sql);
      const sendFounderTest = createFounderTestSender({
        repository: issueRepository,
        resend: founderTest.gateway,
        fromEmail: FROM_EMAIL,
        founderEmail: FOUNDER.email,
        unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
        siteOrigin: SITE_ORIGIN,
      });
      await sendFounderTest(sql, {
        issueId: issueAId,
        founder: FOUNDER,
        correlationId: randomUUID(),
      });
      assert.equal(founderTest.sent.length, 1);
      assert.equal(founderTest.sent[0]?.to, FOUNDER.email);

      const [subscriberAfterTest] = await sql<{ status: string }[]>`
        select status from growth.newsletter_subscribers
        where normalised_email = ${leadA.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberAfterTest.status, "subscribed", "the founder test never touches subscriber state");

      // --- Step 4: approve then schedule. scheduledFor must be in the
      // future at schedule time; the dispatcher is later run with `now`
      // pushed past it so it picks the issue up immediately. ---
      const approveIssue = createIssueApprover({ repository: issueRepository });
      const approved = await approveIssue(sql, {
        issueId: issueAId,
        expectedVersion: 1,
        founder: FOUNDER,
        correlationId: randomUUID(),
      });

      const scheduledFor = new Date(Date.now() + 5_000);
      const scheduleIssue = createIssueScheduler({ repository: issueRepository });
      await scheduleIssue(sql, {
        issueId: issueAId,
        expectedVersion: approved.version,
        scheduledFor,
        founder: FOUNDER,
        correlationId: randomUUID(),
      });

      // --- Step 5: dispatch. The subscriber gets a real, per-recipient
      // unsubscribe link, not the literal placeholder. ---
      const dispatchResend = fakeResend();
      const dispatchDueNewsletters = createNewsletterDispatcher({
        repository: postgresNewsletterDispatchRepository,
        resend: dispatchResend.gateway,
        fromEmail: FROM_EMAIL,
        replyToEmail: REPLY_TO_EMAIL,
        unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
        siteOrigin: SITE_ORIGIN,
        now: () => new Date(scheduledFor.getTime() + 1_000),
      });
      const dispatchSummary = await dispatchDueNewsletters(sql);
      assert.ok(dispatchSummary.seededIssues >= 1, "at least this test's due issue was seeded");
      assert.ok(dispatchSummary.sent >= 1, "at least this test's send went out");

      const sentToLeadA = dispatchResend.sent.find((message) => message.to === leadA.workEmail.toLowerCase());
      assert.ok(sentToLeadA, "the subscriber received the newsletter send");
      assert.doesNotMatch(sentToLeadA!.html, new RegExp(escapeRegExp(UNSUBSCRIBE_URL_PLACEHOLDER)));
      assert.match(sentToLeadA!.html, new RegExp(`${SITE_ORIGIN}/api/newsletter/unsubscribe\\?token=`));

      const [sendRow] = await sql<{ providerMessageId: string; status: string }[]>`
        select provider_message_id as "providerMessageId", status
        from growth.newsletter_sends s
        inner join growth.newsletter_subscribers sub on sub.id = s.subscriber_id
        where sub.normalised_email = ${leadA.workEmail.toLowerCase()} and s.newsletter_issue_id = ${issueAId}
      `;
      assert.equal(sendRow.status, "sent");

      // --- Step 6: a signed webhook bounce suppresses the recipient. ---
      const providerMessageId = sendRow.providerMessageId;
      const bounceTimestamp = new Date();
      const bouncePayload = JSON.stringify({
        type: "email.bounced",
        created_at: bounceTimestamp.toISOString(),
        data: { email_id: providerMessageId, to: leadA.workEmail, bounce: { type: "Permanent" } },
      });
      const bounceMsgId = `msg_${randomUUID()}`;
      const bounceSignature = new Webhook(WEBHOOK_SECRET).sign(bounceMsgId, bounceTimestamp, bouncePayload);
      const bounceHeaders = {
        "svix-id": bounceMsgId,
        "svix-timestamp": String(Math.floor(bounceTimestamp.getTime() / 1000)),
        "svix-signature": bounceSignature,
      };

      const subscribersRepo = createNewsletterSubscriberRepository(sql);
      const stopSequenceStub = async (): Promise<StoppedSequence> => {
        throw new Error("no sequence enrollment is expected for this recipient");
      };
      const webhookDeps: ResendWebhookDependencies = {
        repository: createPostgresResendWebhookRepository(sql),
        suppression: {
          findSubscriberStatusByEmail: async (normalisedEmail) => {
            const record = await subscribersRepo.findSubscriberByEmail(normalisedEmail);
            return record ? { status: record.status } : null;
          },
          upsertSuppressedStatus: (normalisedEmail, status, at) =>
            upsertSuppressedStatus(sql, normalisedEmail, status, at),
        },
        cancelQueuedSendsForEmail: (normalisedEmail, errorCode) =>
          postgresNewsletterDispatchRepository.cancelQueuedSendsForEmail(sql, normalisedEmail, errorCode),
        stopSequence: stopSequenceStub,
        appendAuditEvent: (input) => appendAuditEvent(sql, input),
      };

      const bounceResult = await handleResendWebhook(
        { rawBody: bouncePayload, headers: bounceHeaders, secret: WEBHOOK_SECRET },
        webhookDeps,
      );
      assert.deepEqual(bounceResult, { status: "applied", duplicate: false });

      const [subscriberAfterBounce] = await sql<{ status: string }[]>`
        select status from growth.newsletter_subscribers where normalised_email = ${leadA.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberAfterBounce.status, "bounced");

      const [suppressionCount] = await sql<{ count: string }[]>`
        select count(*)::text as count from growth.suppressions where normalised_email = ${leadA.workEmail.toLowerCase()}
      `;
      assert.equal(suppressionCount.count, "1");

      // --- Step 6b: a later newsletter issue does not send to the now-
      // suppressed recipient (recipient selection excludes non-subscribed
      // subscribers at seed time). ---
      issueBId = await insertDraftIssue(sql, {
        issueKey: issueKeyB,
        status: "scheduled",
        scheduledFor: new Date(Date.now() - 1_000),
      });
      const secondDispatch = createNewsletterDispatcher({
        repository: postgresNewsletterDispatchRepository,
        resend: fakeResend().gateway,
        fromEmail: FROM_EMAIL,
        replyToEmail: REPLY_TO_EMAIL,
        unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
        siteOrigin: SITE_ORIGIN,
      });
      await secondDispatch(sql);

      const [blockedSendCount] = await sql<{ count: string }[]>`
        select count(*)::text as count
        from growth.newsletter_sends s
        inner join growth.newsletter_subscribers sub on sub.id = s.subscriber_id
        where sub.normalised_email = ${leadA.workEmail.toLowerCase()} and s.newsletter_issue_id = ${issueBId}
      `;
      assert.equal(blockedSendCount.count, "0", "the bounced recipient was never seeded a send for the new issue");

      // --- Step 7: unsubscribe via the real route handler and a real
      // signed token, for a still-subscribed recipient. ---
      await submitLeadInTransaction(leadB, sql);
      const [subscriberB] = await sql<{ status: string }[]>`
        select status from growth.newsletter_subscribers where normalised_email = ${leadB.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberB.status, "subscribed");

      const unsubscribeToken = signUnsubscribeToken(leadB.workEmail, UNSUBSCRIBE_TOKEN_SECRET);
      const unsubscribeHandler = createUnsubscribeRouteHandler({
        tokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
        subscribers: subscribersRepo,
      });
      const unsubscribeResponse = await unsubscribeHandler(
        new Request(`${SITE_ORIGIN}/api/newsletter/unsubscribe?token=${unsubscribeToken}`),
      );
      assert.equal(unsubscribeResponse.status, 200);

      const [subscriberBAfter] = await sql<{ status: string }[]>`
        select status from growth.newsletter_subscribers where normalised_email = ${leadB.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberBAfter.status, "unsubscribed");

      // --- Step 8: replaying the same signed bounce event is a no-op: no
      // duplicate suppression row, no duplicate delivery event. ---
      const replayResult = await handleResendWebhook(
        { rawBody: bouncePayload, headers: bounceHeaders, secret: WEBHOOK_SECRET },
        webhookDeps,
      );
      assert.deepEqual(replayResult, { status: "applied", duplicate: true });

      const [suppressionCountAfterReplay] = await sql<{ count: string }[]>`
        select count(*)::text as count from growth.suppressions where normalised_email = ${leadA.workEmail.toLowerCase()}
      `;
      assert.equal(suppressionCountAfterReplay.count, "1", "replaying the bounce does not duplicate the suppression");

      const [deliveryEventCount] = await sql<{ count: string }[]>`
        select count(*)::text as count from growth.resend_delivery_events where provider_event_id = ${bounceMsgId}
      `;
      assert.equal(deliveryEventCount.count, "1", "replaying the bounce does not duplicate the delivery event");
    } finally {
      const emails = [leadA.workEmail.toLowerCase(), leadB.workEmail.toLowerCase()];
      if (issueBId) {
        await sql`delete from growth.newsletter_sends where newsletter_issue_id = ${issueBId}`;
        await sql`delete from growth.newsletter_issues where id = ${issueBId}`;
      }
      if (issueAId) {
        await sql`delete from growth.newsletter_sends where newsletter_issue_id = ${issueAId}`;
        await sql`delete from growth.newsletter_issues where id = ${issueAId}`;
      }
      await sql`delete from growth.resend_delivery_events where recipient_normalised_email = ${emails[0]}`;
      await sql`delete from growth.suppressions where normalised_email = ${emails[0]}`;
      await sql`delete from growth.newsletter_subscribers where normalised_email in ${sql(emails)}`;
      await sql`delete from growth.audit_log where correlation_id in (${leadA.submissionId}, ${leadB.submissionId})`;
      await sql`delete from growth.inbound_leads where submission_id in (${leadA.submissionId}, ${leadB.submissionId})`;
      await sql.end();
    }
  },
);
