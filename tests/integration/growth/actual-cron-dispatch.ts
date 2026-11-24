import { assertDisposableGrowthDatabase } from "./disposable-database";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { encryptRefreshToken } from "../../../lib/growth/integrations/token-crypto";
import { createGlobalResearchFixture } from "../../../lib/growth/research/global-test-fixture";
import { globalResearchRunSchema } from "../../../lib/growth/research/global-schema";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { getMessageReview } from "../../../lib/growth/dashboard/message-review";

// Calls the real cron handler against a synthetic local account and a closed fetch stub.
export async function exerciseActualCronDispatch(
  admin: GrowthDb,
  db: GrowthDb,
  input: { connectionId: string; email: string; url: string },
): Promise<void> {
  assertDisposableGrowthDatabase(input.url);
  const [role] = await db<{ role: string }[]>`select current_user as role`;
  assert.equal(role?.role, "growth_app");
  const business = randomUUID(),
    contact = randomUUID(),
    prospect = randomUUID(),
    sequence = randomUUID(),
    message = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const researchKey = randomUUID();
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptRefreshToken("synthetic-token", {
    version: "v1",
    key,
  });
  const savedEnv = process.env;
  const savedFetch = globalThis.fetch;
  const dbUrl = new URL(input.url);
  dbUrl.searchParams.set("options", "-c role=growth_app");
  let posts = 0;
  let tokenRequests = 0;
  let profileRequests = 0;
  let providerCreatedAt = 0;
  let configured = false;
  try {
    await admin`update growth.integration_connections set encrypted_refresh_token=${JSON.stringify(encrypted)},encryption_key_version='v1' where id=${input.connectionId}`;
    await admin`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},'Cron fixture','limited_company','active','Test','Test','https://example.test','GB')`;
    await admin`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${email},'https://example.test',now(),'corporate','consent')`;
    await admin`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,${input.email})`;
    await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,template_snapshot) values (${sequence},${prospect},${contact},'active',${admin.json({ approvedRecipient: email, effectiveRecipient: { email, contactId: contact, contactVersion: 1, prospectVersion: 1 } })})`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,scheduled_for,subject_snapshot,html_snapshot,text_snapshot) values (${message},${sequence},${prospect},${contact},'gmail','outbound',0,'queued',${`cron-test:${message}`},now()-interval '1 minute','Subject','<p>Body</p>','Body')`;
    process.env = {
      NODE_ENV: "test",
      DATABASE_URL: dbUrl.toString(),
      AUTH_SECRET: "a".repeat(32),
      GOOGLE_AUTH_CLIENT_ID: "test",
      GOOGLE_AUTH_CLIENT_SECRET: "test",
      GOOGLE_GMAIL_CLIENT_ID: "test",
      GOOGLE_GMAIL_CLIENT_SECRET: "test",
      GOOGLE_GMAIL_REDIRECT_URI:
        "http://localhost/api/integrations/gmail/callback",
      GROWTH_OS_OWNER_EMAIL: input.email,
      TOKEN_ENCRYPTION_KEY: key.toString("base64"),
      CRON_SECRET: "c".repeat(32),
      GROWTH_OS_AUTOMATIONS_ENABLED: "true",
    };
    configured = true;
    globalThis.fetch = async (resource, init) => {
      const url = new URL(String(resource));
      if (url.href === "https://oauth2.googleapis.com/token") {
        tokenRequests++;
        return Response.json({
          access_token: "synthetic-access",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      if (url.origin !== "https://gmail.googleapis.com")
        throw new Error("unexpected network");
      if (url.pathname.endsWith("/messages/send") && init?.method === "POST") {
        posts++;
        if (posts === 2) providerCreatedAt = Date.now();
        return Response.json({
          id: `fixture-provider-${posts}`,
          threadId: `fixture-thread-${posts}`,
        });
      }
      if (url.pathname.endsWith("/profile")) {
        profileRequests++;
        return Response.json({ emailAddress: input.email, historyId: "200" });
      }
      if (url.pathname.endsWith("/history"))
        return Response.json({ historyId: "200", history: [] });
      if (url.pathname.endsWith("/messages/fixture-provider-2"))
        return Response.json({
          id: "fixture-provider-2",
          threadId: "fixture-thread-2",
          historyId: "200",
          labelIds: ["SENT"],
          internalDate: String(providerCreatedAt),
          payload: {
            headers: [
              { name: "From", value: input.email },
              { name: "To", value: email },
              {
                name: "Message-ID",
                value: `<growthos.${message}@faithfulsoftware.dev>`,
              },
            ],
          },
        });
      if (
        url.pathname.endsWith("/messages") &&
        posts >= 2 &&
        url.searchParams.get("q")?.includes(message)
      )
        return Response.json({
          messages: [
            { id: "fixture-provider-2", threadId: "fixture-thread-2" },
          ],
        });
      if (url.pathname.endsWith("/messages"))
        return Response.json({ messages: [] });
      throw new Error(`unexpected Gmail path: ${url.pathname}`);
    };
    const { createResearchEmailSendHandler } =
      await import("../../../lib/growth/sequences/research-email-send-route");
    const missingDraft = randomUUID();
    const research = createResearchEmailSendHandler({
      db,
      config: { origin: "https://example.test" },
      founderEmail: input.email,
      gmailClientId: "test",
      gmailClientSecret: "test",
      decryptionKeys: { v1: key },
      authorizeFounder: async () => ({
        email: input.email,
        actorId: "a".repeat(64),
      }),
      createCorrelationId: () => researchKey,
      reportUnexpectedError: () => {},
    });
    const staleResponse = await research(
      new Request(
        `https://example.test/api/growth/messages/${missingDraft}/approve-research-send`,
        {
          method: "POST",
          headers: {
            origin: "https://example.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: 1,
            expectedProspectVersion: 1,
            reviewedRecipient: {
              email,
              contactId: contact,
              contactVersion: 1,
              prospectVersion: 1,
            },
            fingerprint: "a".repeat(64),
            permission: {
              basis: "consent",
              evidence: "Recipient requested this information.",
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: missingDraft }) },
    );
    assert.equal(staleResponse.status, 404);
    assert.equal(posts, 0);
    const run = globalResearchRunSchema.parse(createGlobalResearchFixture());
    run.externalRunId = researchKey;
    const candidate = run.prospects[0];
    assert.ok(candidate);
    candidate.business.legalName = `research-${researchKey}`;
    candidate.business.websiteUrl = `https://${researchKey}.example.test`;
    candidate.business.firstPartySourceUrl = `${candidate.business.websiteUrl}/contact`;
    candidate.contact.email = `research-${researchKey}@example.test`;
    candidate.contact.emailSourceUrl = candidate.business.firstPartySourceUrl;
    candidate.evidence[0]!.sourceUrl = candidate.business.firstPartySourceUrl;
    const ingested = await ingestResearchRun(admin, run);
    const researchProspect = ingested.acceptedProspects[0]?.prospectId;
    assert.ok(researchProspect);
    const [task] = await admin<
      { id: string }[]
    >`select id from growth.agent_tasks where prospect_id=${researchProspect}`;
    assert.ok(task);
    const review = await getMessageReview(
      task.id,
      input.email,
      "https://example.test",
      admin,
    );
    if (review.status !== "ready")
      throw new Error("research review unavailable");
    const researchRequest = (fingerprint: string | null | undefined) =>
      new Request(
        `https://example.test/api/growth/messages/${task.id}/approve-research-send`,
        {
          method: "POST",
          headers: {
            origin: "https://example.test",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: review.data.version,
            expectedProspectVersion: review.data.prospectVersion,
            reviewedRecipient: review.data.reviewedRecipient,
            fingerprint,
            permission: {
              basis: "consent",
              evidence: "Recipient requested this information.",
            },
          }),
        },
      );
    const staleApproval = await research(researchRequest("0".repeat(64)), {
      params: Promise.resolve({ id: task.id }),
    });
    assert.equal(staleApproval.status, 409);
    assert.equal(posts, 0);
    const researchResponse = await research(
      researchRequest(review.data.approvalFingerprint),
      { params: Promise.resolve({ id: task.id }) },
    );
    const researchResult = await researchResponse.json();
    assert.equal(researchResponse.status, 200, JSON.stringify(researchResult));
    assert.equal(researchResult.status, "pending");
    assert.equal(posts, 1);
    const [researchStored] = await admin<
      {
        status: string;
        proof: unknown;
        receipt: unknown;
        sentAt: Date | null;
      }[]
    >`
      select r.status,r.direct_submission_evidence as proof,r.confirmation_receipt as receipt,r.actual_sent_at as "sentAt"
      from growth.outreach_reservations r join growth.email_messages em on em.id=r.email_message_id where em.prospect_id=${researchProspect}`;
    assert.equal(researchStored?.status, "accepted");
    assert.ok(researchStored?.proof);
    assert.equal(researchStored?.receipt, null);
    assert.equal(researchStored?.sentAt, null);
    const route = await import("../../../app/api/cron/outreach-dispatch/route");
    const response = await route.GET(
      new Request("https://example.test/api/cron/outreach-dispatch", {
        headers: { authorization: `Bearer ${"c".repeat(32)}` },
      }),
    );
    const body: unknown = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const [stored] = await admin<
      {
        status: string;
        proof: unknown;
        receipt: unknown;
        sentAt: Date | null;
      }[]
    >`select status,direct_submission_evidence as proof,confirmation_receipt as receipt,actual_sent_at as "sentAt" from growth.outreach_reservations where email_message_id=${message}`;
    assert.equal(posts, 2, JSON.stringify(body));
    assert.equal(stored?.status, "accepted");
    assert.ok(stored?.proof);
    assert.ok(stored?.receipt);
    assert.equal(stored?.sentAt, null);
    process.env.GROWTH_OS_OUTREACH_PREPARATION_ENABLED = "true";
    tokenRequests = 0;
    profileRequests = 0;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const sharedResponse = await route.GET(
      new Request("https://example.test/api/cron/outreach-dispatch", {
        headers: { authorization: `Bearer ${"c".repeat(32)}` },
      }),
    );
    const sharedBody = await sharedResponse.json();
    assert.equal(sharedResponse.status, 200, JSON.stringify(sharedBody));
    assert.ok(sharedBody.preparation);
    assert.equal(tokenRequests, 1);
    assert.equal(profileRequests, 2);
    assert.equal(posts, 2);
    process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED = "true";
    tokenRequests = 0;
    profileRequests = 0;
    const enabledResponse = await route.GET(
      new Request("https://example.test/api/cron/outreach-dispatch", {
        headers: { authorization: `Bearer ${"c".repeat(32)}` },
      }),
    );
    const enabledBody = await enabledResponse.json();
    assert.equal(enabledResponse.status, 200, JSON.stringify(enabledBody));
    assert.deepEqual(
      { status: enabledBody.resend.status, reason: enabledBody.resend.reason },
      { status: "held", reason: "account_binding_unknown" },
    );
    assert.equal(tokenRequests, 1);
    assert.equal(profileRequests, 2);
    assert.equal(posts, 2);
  } finally {
    globalThis.fetch = savedFetch;
    if (configured) {
      const { getGrowthDb } = await import("../../../lib/growth/db/client");
      await getGrowthDb().end();
    }
    process.env = savedEnv;
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where sequence_id in (select id from growth.sequence_enrollments where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey}))))`;
    await admin`delete from growth.outreach_reservations where sequence_id in (select id from growth.sequence_enrollments where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey})))`;
    await admin`update growth.sequence_enrollments set first_message_id=null where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey}))`;
    await admin`delete from growth.email_messages where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey}))`;
    await admin`delete from growth.sequence_enrollments where prospect_id in (select id from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey}))`;
    await admin`delete from growth.agent_tasks where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey})`;
    await admin`delete from growth.source_evidence where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey})`;
    await admin`delete from growth.audit_log where correlation_id=${researchKey}`;
    await admin`delete from growth.prospects where research_run_id in (select id from growth.research_runs where external_run_id=${researchKey})`;
    await admin`delete from growth.contacts where business_id in (select id from growth.businesses where legal_name=${`research-${researchKey}`})`;
    await admin`delete from growth.businesses where legal_name=${`research-${researchKey}`}`;
    await admin`delete from growth.research_runs where external_run_id=${researchKey}`;
    await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id=${message})`;
    await admin`delete from growth.outreach_reservations where email_message_id=${message}`;
    await admin`delete from growth.email_messages where sequence_enrollment_id=${sequence}`;
    await admin`delete from growth.sequence_enrollments where id=${sequence}`;
    await admin`delete from growth.prospects where id=${prospect}`;
    await admin`delete from growth.contacts where id=${contact}`;
    await admin`delete from growth.businesses where id=${business}`;
    await admin`delete from growth.gmail_reply_coverage where connection_id=${input.connectionId}`;
    await admin`update growth.integration_connections set encrypted_refresh_token=null,encryption_key_version=null where id=${input.connectionId}`;
  }
}
