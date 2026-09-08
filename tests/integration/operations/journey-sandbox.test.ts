import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { onboardingFixture } from "./onboarding-fixtures";
import { billingProviderFixture } from "./billing-provider-fixture";
import { executeJourneyCommand } from "../../../lib/operations/onboarding/commands";
import { createJourneyCommandHandler } from "../../../lib/operations/onboarding/http";
import { listFounderJourneys } from "../../../lib/operations/onboarding/queries";
import { onboardingEffects } from "../../../lib/operations/onboarding/effects";
import { createOnboardingBillingProvider } from "../../../lib/operations/onboarding/billing-provider";
import { createOnboardingAccessProvider } from "../../../lib/operations/onboarding/access-provider";
import { runOnboardingWorker } from "../../../lib/operations/onboarding/worker";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import type { JourneyCommandResult } from "../../../lib/operations/onboarding/command-types";
test("synthetic HTTP journey issues one invoice and appropriate per-recipient messages after all signatures, preserving newsletter opt-out", async (t) => {
  const extra = `owner-${randomUUID()}@example.test`;
  const f = await onboardingFixture(t, 2, {
    taxFree: true,
    accessContacts: [{ email: extra, role: "owner" }],
  });
  const key = Buffer.alloc(32, 9),
    origin = "https://example.test";
  const names = [
    "OPERATIONS_ENABLED",
    "OPERATIONS_ONBOARDING_ENABLED",
    "OPERATIONS_PORTAL_ORIGIN",
    "OPERATIONS_RESEND_API_KEY",
    "OPERATIONS_ONBOARDING_INVITE_KEY",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  const fetch = globalThis.fetch;
  t.after(async () => {
    globalThis.fetch = fetch;
    for (const [name, value] of previous)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    const cleanup = postgres(
      requireOperationsTestDatabaseUrl(
        process.env.OPERATIONS_TEST_DATABASE_URL,
      ),
    );
    try {
      await cleanup`delete from growth.newsletter_subscribers where normalised_email=${f.identities[0].email}`;
    } finally {
      await cleanup.end();
    }
  });
  Object.assign(process.env, {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_ONBOARDING_ENABLED: "true",
    OPERATIONS_PORTAL_ORIGIN: origin,
    OPERATIONS_RESEND_API_KEY: "re_synthetic",
    OPERATIONS_ONBOARDING_INVITE_KEY: key.toString("base64"),
  });
  await f.admin`delete from growth.newsletter_subscribers where normalised_email=${f.identities[0].email} and status='unsubscribed'`;
  await f.admin`insert into growth.newsletter_subscribers(email,status,unsubscribed_at) values(${f.identities[0].email},'unsubscribed',clock_timestamp())`;
  const mail = new Map<string, { to: string; subject: string; html: string }>();
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(
      url.startsWith("https://api.resend.com/emails"),
      "No external provider traffic permitted",
    );
    if (init?.method === "POST") {
      const sent = JSON.parse(String(init.body));
      const id = `synthetic-${mail.size + 1}`;
      assert.doesNotMatch(sent.html, /newsletter|subscribe/i);
      mail.set(id, {
        to: typeof sent.to === "string" ? sent.to : sent.to[0],
        subject: sent.subject,
        html: sent.html,
      });
      return Response.json({ id });
    }
    const id = url.split("/").pop()!;
    const sent = mail.get(id);
    assert.ok(sent);
    return Response.json({
      id,
      created_at: new Date().toISOString(),
      from: f.prepared.snapshot.welcome.from,
      to: [sent.to],
    });
  };
  const http = createJourneyCommandHandler({
    enabled: true,
    origin,
    createCorrelationId: randomUUID,
    authorize: async () => f.founder,
    reportUnexpectedError: (report) => assert.fail(JSON.stringify(report)),
    execute: (identity, org, raw) =>
      executeJourneyCommand(f.founderDb, identity, org, raw, {
        billing: { accountId: "acct_billingTest", livemode: false },
        previewKey: key,
        portalOrigin: origin,
      }),
  });
  const post = async (command: unknown): Promise<JourneyCommandResult> => {
    const response = await http(
      new Request(`${origin}/journey`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(command),
      }),
      f.organisationId,
    );
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  await f.admin`delete from operations.onboarding_jobs where journey_id=${f.journeyId}`;
  await f.admin`delete from operations.onboarding_journeys where id=${f.journeyId}`;
  await f.admin`delete from operations.onboarding_approvals where id=${f.approvalId}`;
  const { recipient, invoice, content, thankYou } = f.prepared.snapshot;
  const welcome = await post({
    action: "preview_welcome",
    agreementId: f.record.id,
    expectedVersion: f.signingApproval.agreementVersion,
    welcome: { recipient, invoice, content, thankYou },
  });
  assert.ok("preview" in welcome);
  const start = await post({
    action: "start",
    token: welcome.preview.token,
    confirmed: true,
  });
  assert.ok("journeyId" in start);
  const journeyId = start.journeyId;
  const provider = billingProviderFixture();
  const access = createOnboardingAccessProvider(
    f.worker,
    key,
    origin,
    async () => {},
  );
  const effects = {
    ...onboardingEffects(f.worker),
    ensureProposalAccess: access,
    ensureInvitation: access,
    createInvoice: createOnboardingBillingProvider(f.worker, provider.stripe, {
      accountId: "acct_billingTest",
      mode: "test",
      portalOrigin: origin,
    }),
  };
  assert.equal((await runOnboardingWorker(f.store, effects)).succeeded, 1);
  const proposal = await post({
    action: "preview_proposal",
    journeyId,
    expectedGeneration: 1,
    expectedProposalApprovalId: null,
    signingApprovalId: f.signingApproval.id,
    access: f.proposal.access,
    scopeSummary: "the approved request board",
  });
  assert.ok("preview" in proposal);
  await post({
    action: "approve_proposal",
    token: proposal.preview.token,
    confirmed: true,
  });
  const twoHours = () => new Date(Date.now() + 3 * 3600000);
  await runOnboardingWorker(f.store, effects, { now: twoHours });
  await runOnboardingWorker(f.store, effects, { now: twoHours });
  assert.equal(
    [...mail.values()].filter((m) => m.subject.includes("proposal")).length,
    2,
  );
  await f.sign(f.signingApproval, 0);
  assert.equal(
    await completeAgreementSigning(
      f.signingWorker,
      f.signingApproval.id,
      f.correlationId,
    ),
    false,
  );
  await runOnboardingWorker(f.store, effects, { now: twoHours });
  assert.equal(provider.requests.length, 0);
  await f.sign(f.signingApproval, 1);
  assert.equal(
    await completeAgreementSigning(
      f.signingWorker,
      f.signingApproval.id,
      f.correlationId,
    ),
    true,
  );
  const future = () => new Date(Date.now() + 2 * 86400000);
  for (let i = 0; i < 5; i++)
    await runOnboardingWorker(f.store, effects, { now: future });
  assert.equal(
    provider.requests.filter(
      (r) => r.method === "POST" && r.path === "/v1/invoices",
    ).length,
    1,
  );
  const [view] = await listFounderJourneys(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  assert.equal(view.state, "completed");
  assert.equal(mail.size, 5);
  assert.equal([...mail.values()].filter((m) => m.to === extra).length, 1);
  assert.equal(
    [...mail.values()].filter((m) => m.to === f.identities[1].email).length,
    1,
  );
  const [invites] = await f.admin<
    { n: number }[]
  >`select count(*)::int as n from operations.portal_invites where organisation_id=${f.organisationId}`;
  assert.equal(invites.n, 1);
  const [subscriber] = await f.admin<
    { status: string }[]
  >`select status from growth.newsletter_subscribers where normalised_email=${f.identities[0].email}`;
  assert.equal(subscriber.status, "unsubscribed");
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await runOnboardingWorker(f.store, effects, { now: future })).claimed,
      0,
    );
  assert.equal(mail.size, 5);
});
