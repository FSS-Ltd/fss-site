import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { onboardingFixture } from "./onboarding-fixtures";
import { executeJourneyCommand } from "../../../lib/operations/onboarding/commands";
import { listFounderJourneys } from "../../../lib/operations/onboarding/queries";
import { createJourneyCommandHandler } from "../../../lib/operations/onboarding/http";
import type {
  JourneyCommandResult,
  ProposalPreview,
  WelcomePreview,
} from "../../../lib/operations/onboarding/command-types";
const options = {
  billing: { accountId: "acct_billingTest", livemode: false },
  previewKey: Buffer.alloc(32, 7),
  portalOrigin: "https://example.test",
};
function request(command: unknown) {
  return new Request("https://fss.test/journey", {
    method: "POST",
    headers: { origin: "https://fss.test", "content-type": "application/json" },
    body: JSON.stringify(command),
  });
}
function handler(f: Awaited<ReturnType<typeof onboardingFixture>>) {
  return createJourneyCommandHandler({
    enabled: true,
    origin: "https://fss.test",
    createCorrelationId: randomUUID,
    authorize: async () => f.founder,
    reportUnexpectedError: (report) => assert.fail(JSON.stringify(report)),
    execute: (identity, org, command) =>
      executeJourneyCommand(f.founderDb, identity, org, command, options),
  });
}
async function body(response: Response): Promise<JourneyCommandResult> {
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
test("HTTP separates welcome/proposal approvals and rejects stale or cross-organisation approval", async (t) => {
  const f = await onboardingFixture(t, 1);
  const http = handler(f);
  const binding = {
    journeyId: f.journeyId,
    expectedGeneration: 1,
    expectedProposalApprovalId: null,
  };
  const [before] = await listFounderJourneys(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  assert.equal(before.proposal, null);
  const result = await body(
    await http(
      request({
        action: "preview_proposal",
        ...binding,
        signingApprovalId: f.signingApproval.id,
        access: f.proposal.access,
        scopeSummary: "the agreed request board",
      }),
      f.organisationId,
    ),
  );
  assert.ok("preview" in result && result.preview.kind === "proposal");
  const preview = result.preview as ProposalPreview;
  assert.doesNotMatch(
    JSON.stringify(preview.snapshot),
    /newsletter|subscribe/i,
  );
  assert.equal(
    (
      await http(
        request({
          action: "approve_proposal",
          token: preview.token,
          confirmed: true,
        }),
        randomUUID(),
      )
    ).status,
    409,
  );
  await body(
    await http(request({ action: "pause", ...binding }), f.organisationId),
  );
  assert.equal(
    (
      await http(
        request({
          action: "approve_proposal",
          token: preview.token,
          confirmed: true,
        }),
        f.organisationId,
      )
    ).status,
    409,
  );
  assert.equal(
    (await http(request({ action: "resume", ...binding }), f.organisationId))
      .status,
    409,
  );
  await body(
    await http(
      request({ action: "resume", ...binding, expectedGeneration: 2 }),
      f.organisationId,
    ),
  );
  const updated = await body(
    await http(
      request({
        action: "preview_proposal",
        ...binding,
        expectedGeneration: 3,
        signingApprovalId: f.signingApproval.id,
        access: f.proposal.access,
        scopeSummary: "the agreed request board",
      }),
      f.organisationId,
    ),
  );
  assert.ok("preview" in updated);
  await body(
    await http(
      request({
        action: "approve_proposal",
        token: updated.preview.token,
        confirmed: true,
      }),
      f.organisationId,
    ),
  );
  const [after] = await listFounderJourneys(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  assert.equal(after.proposal?.signers[0], f.identities[0].email);
  assert.equal(after.currentProposal, true);
});
test("welcome starts exact PDF once; stale preview cannot start after agreement changes", async (t) => {
  const f = await onboardingFixture(t, 1);
  const http = handler(f);
  await f.admin`delete from operations.onboarding_jobs where journey_id=${f.journeyId}`;
  await f.admin`delete from operations.onboarding_journeys where id=${f.journeyId}`;
  await f.admin`delete from operations.onboarding_approvals where id=${f.approvalId}`;
  const { recipient, invoice, content, thankYou } = f.prepared.snapshot;
  const result = await body(
    await http(
      request({
        action: "preview_welcome",
        agreementId: f.record.id,
        expectedVersion: f.signingApproval.agreementVersion,
        welcome: { recipient, invoice, content, thankYou },
      }),
      f.organisationId,
    ),
  );
  assert.ok("preview" in result && result.preview.kind === "welcome");
  const preview = result.preview as WelcomePreview;
  assert.doesNotMatch(
    JSON.stringify(preview.snapshot),
    /newsletter|subscribe/i,
  );
  const start = { action: "start", token: preview.token, confirmed: true };
  await body(await http(request(start), f.organisationId));
  await body(await http(request(start), f.organisationId));
  const [saved] = await f.admin<
    { pdf: Buffer; n: number }[]
  >`select pdf,(select count(*)::int from operations.onboarding_journeys where organisation_id=${f.organisationId}) as n from operations.onboarding_approvals where organisation_id=${f.organisationId}`;
  assert.equal(saved.pdf.toString("base64"), preview.pdfBase64);
  assert.equal(saved.n, 1);
});
test("HTTP cancellation retains in-flight known acceptance and safe pause/resume never replays completed effects", async (t) => {
  const f = await onboardingFixture(t, 1);
  const http = handler(f);
  const [lease] = await f.store.claim(1, new Date());
  assert.equal(await f.store.beginEffect(lease, new Date()), true);
  await body(
    await http(
      request({
        action: "cancel",
        journeyId: f.journeyId,
        expectedGeneration: 1,
        expectedProposalApprovalId: null,
      }),
      f.organisationId,
    ),
  );
  await f.store.succeed(lease, {
    providerId: "known-accepted",
    acceptedAt: new Date().toISOString(),
  });
  const [view] = await listFounderJourneys(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  assert.equal(view.state, "cancelled");
  assert.equal(view.jobs[0].providerId, "known-accepted");
  assert.equal((await f.store.claim(10, new Date())).length, 0);
  assert.equal(
    (
      await http(
        request({
          action: "resume",
          journeyId: f.journeyId,
          expectedGeneration: 2,
          expectedProposalApprovalId: null,
        }),
        f.organisationId,
      )
    ).status,
    409,
  );
});
test("HTTP reconciles only positive original acceptance for exact scoped uncertain job", async (t) => {
  const f = await onboardingFixture(t, 1);
  const http = handler(f);
  const [lease] = await f.store.claim(1, new Date());
  await f.store.beginEffect(lease, new Date());
  await f.store.fail(lease, "dedupe_window_expired", null, true);
  const command = {
    action: "reconcile",
    journeyId: f.journeyId,
    expectedGeneration: 1,
    expectedProposalApprovalId: null,
    jobId: lease.jobId,
    providerId: "original-accepted",
    acceptedAt: new Date().toISOString(),
    reviewReference: "provider-review-11",
    confirmed: true,
  };
  assert.equal(
    (await http(request({ ...command, jobId: randomUUID() }), f.organisationId))
      .status,
    409,
  );
  await body(await http(request(command), f.organisationId));
  const [view] = await listFounderJourneys(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  assert.equal(view.jobs[0].providerId, "original-accepted");
  assert.equal(view.jobs[0].uncertain, false);
  assert.equal((await http(request(command), f.organisationId)).status, 409);
});

test("held definite failure recovery retains permanent key and rejects uncertainty or cross-organisation attempts", async (t) => {
  const f = await onboardingFixture(t, 1);
  const http = handler(f);
  const [lease] = await f.store.claim(1, new Date());
  await f.store.beginEffect(lease, new Date());
  await f.store.fail(lease, "configuration", null, false);
  const command = {
    action: "retry",
    journeyId: f.journeyId,
    expectedGeneration: 1,
    expectedProposalApprovalId: null,
    jobId: lease.jobId,
    reviewReference: "configuration corrected",
    confirmed: true,
  };
  assert.equal((await http(request(command), randomUUID())).status, 409);
  await body(await http(request(command), f.organisationId));
  const [again] = await f.store.claim(1, new Date(Date.now() + 1000));
  assert.equal(again.idempotencyKey, lease.idempotencyKey);
  assert.equal(again.attempts, 1);
  await f.store.beginEffect(again, new Date());
  await f.store.fail(again, "configuration", null, true);
  assert.equal((await http(request(command), f.organisationId)).status, 409);
});

test("expired previews and changed agreement versions require fresh review", async (t) => {
  const f = await onboardingFixture(t, 1);
  const { recipient, invoice, content, thankYou } = f.prepared.snapshot;
  const preview = await executeJourneyCommand(
    f.founderDb,
    f.founder,
    f.organisationId,
    {
      action: "preview_welcome",
      agreementId: f.record.id,
      expectedVersion: f.signingApproval.agreementVersion,
      welcome: { recipient, invoice, content, thankYou },
    },
    { ...options, now: () => 100 },
  );
  assert.ok("preview" in preview);
  await assert.rejects(
    executeJourneyCommand(
      f.founderDb,
      f.founder,
      f.organisationId,
      { action: "start", token: preview.preview.token, confirmed: true },
      { ...options, now: () => 1_800_100 },
    ),
    /expired/,
  );
  await f.admin`update operations.agreements set version=version+1 where id=${f.record.id}`;
  await assert.rejects(
    executeJourneyCommand(
      f.founderDb,
      f.founder,
      f.organisationId,
      { action: "start", token: preview.preview.token, confirmed: true },
      { ...options, now: () => 101 },
    ),
    /changed after preview/,
  );
});

test("founder lock/retry functions retain restricted roles and fixed search paths", async (t) => {
  const f = await onboardingFixture(t, 1);
  const rows = await f.admin<
    { name: string; allowed: boolean; fixed: boolean }[]
  >`select p.proname as name,has_function_privilege('operations_founder',p.oid,'execute') and not has_function_privilege('operations_onboarding_worker',p.oid,'execute') and not has_function_privilege('operations_portal',p.oid,'execute') as allowed,coalesce(p.proconfig @> array['search_path=""'],false) as fixed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='operations' and p.proname in ('lock_onboarding_founder','retry_onboarding_failure')`;
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.allowed, true);
    assert.equal(row.fixed, true);
  }
  await assert.rejects(
    f.worker`select operations.lock_onboarding_founder(${f.organisationId},${f.journeyId},1,null)`,
    /permission denied/,
  );
});

test("approved PDF download is private, immutable and organisation scoped", async (t) => {
  const f = await onboardingFixture(t, 1);
  const { loadWelcomePdf, createWelcomeDownloadHandler } =
    await import("../../../lib/operations/onboarding/download");
  const download = createWelcomeDownloadHandler({
    enabled: true,
    createCorrelationId: randomUUID,
    authorize: async () => f.founder,
    reportUnexpectedError: () => assert.fail("unexpected download failure"),
    download: (founder, org, id) =>
      loadWelcomePdf(f.founderDb, founder, org, id),
  });
  const response = await download(f.organisationId, f.journeyId);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(
    Buffer.from(await response.arrayBuffer()).equals(f.prepared.pdf),
    true,
  );
  assert.equal((await download(randomUUID(), f.journeyId)).status, 404);
});

test("founder pause, resume, reconcile and cancel remain available with missing provider configuration", async (t) => {
  const f = await onboardingFixture(t, 1);
  const { journeyCommandOptions } =
    await import("../../../lib/operations/onboarding/command-configuration");
  const unavailable = journeyCommandOptions({});
  const [lease] = await f.store.claim(1, new Date());
  await f.store.beginEffect(lease, new Date());
  await f.store.fail(lease, "unknown_outcome", null, true);
  const execute = (command: unknown) =>
    executeJourneyCommand(
      f.founderDb,
      f.founder,
      f.organisationId,
      command,
      unavailable,
    );
  const binding = { journeyId: f.journeyId, expectedProposalApprovalId: null };
  await execute({ action: "pause", ...binding, expectedGeneration: 1 });
  await execute({ action: "resume", ...binding, expectedGeneration: 2 });
  await execute({
    action: "reconcile",
    ...binding,
    expectedGeneration: 3,
    jobId: lease.jobId,
    providerId: "verified-with-provider-offline",
    acceptedAt: new Date().toISOString(),
    reviewReference: "independent-provider-record",
    confirmed: true,
  });
  await execute({ action: "cancel", ...binding, expectedGeneration: 3 });
  const [view] = await listFounderJourneys(
    f.founderDb,
    f.founder,
    f.organisationId,
  );
  assert.equal(view.state, "cancelled");
  assert.equal(view.jobs[0].providerId, "verified-with-provider-offline");
});
