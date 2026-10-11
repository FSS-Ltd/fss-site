import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import {
  loadAgreement,
  withAgreementTransaction,
} from "../../../lib/operations/agreements/repository";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import { signatureEvidence } from "../../../lib/operations/agreements/fixtures";
import { prepareWelcome } from "../../../lib/operations/onboarding/approval";
import { welcomeFixtureInput } from "../../../lib/operations/onboarding/fixtures";
import { createDesignedWelcomePack } from "../../../lib/operations/onboarding/packet-editions";
import { resolveWelcomePack } from "../../../lib/operations/onboarding/welcome-personalisation";
import { loadCurrentSignedEvidence } from "../../../lib/operations/onboarding/signed-agreement";
import { preparedWelcomeFixture } from "../../../lib/operations/onboarding/fixtures";
import { startApprovedJourney } from "../../../lib/operations/onboarding/repository";
import { signingFixture } from "./signing-fixtures";

const rollback = new Error("rollback post-signature fixture");

test("the start boundary rejects drafts and electronic evidence is bound to its current unarchived revision", async (t) => {
  const fixture = await signingFixture(t, 1);
  await assert.rejects(
    startApprovedJourney(fixture.founderDb, fixture.founder, {
      organisationId: fixture.organisationId,
      agreementId: fixture.record.id,
      approvalId: randomUUID(),
      journeyId: randomUUID(),
      prepared: await preparedWelcomeFixture(fixture.identities[0].email),
    }),
    /Current signed agreement evidence required/,
  );
  const approval = await fixture.approve(await fixture.prepare());
  await fixture.sign(approval);
  assert.equal(
    await completeAgreementSigning(
      fixture.worker,
      approval.id,
      fixture.correlationId,
    ),
    true,
  );
  await withAgreementTransaction(
    fixture.founderDb,
    fixture.founder,
    async (tx) => {
      const agreement = await loadAgreement(
        tx,
        fixture.organisationId,
        fixture.record.id,
      );
      assert.ok(agreement);
      const evidence = await loadCurrentSignedEvidence(
        tx,
        fixture.organisationId,
        agreement,
      );
      assert.equal(
        evidence?.provenance,
        "authenticated_portal_electronic_signature",
      );
      assert.equal(evidence?.revision, agreement.revision);
      assert.equal(
        await loadCurrentSignedEvidence(tx, randomUUID(), agreement),
        null,
      );
    },
  );
  try {
    await fixture.admin.begin(async (tx) => {
      await tx`update operations.agreements set archived_at=clock_timestamp(),archived_by=${fixture.founder.actorId},version=version+1 where id=${fixture.record.id}`;
      const archived = await loadAgreement(
        tx,
        fixture.organisationId,
        fixture.record.id,
      );
      assert.ok(archived);
      assert.equal(
        await loadCurrentSignedEvidence(tx, fixture.organisationId, archived),
        null,
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});

test("post-signature welcome queues invoice and approved access at the next London morning without signing notices", async (t) => {
  const fixture = await signingFixture(t, 1, { taxFree: true });
  const signed = await executeAgreementCommand(
    fixture.founderDb,
    fixture.founder,
    fixture.organisationId,
    {
      action: "sign",
      agreementId: fixture.record.id,
      expectedVersion: fixture.record.version,
      evidence: {
        ...signatureEvidence(),
        signatories: fixture.draft.signatories,
      },
    },
    fixture.correlationId,
  );
  const [evidence] = await fixture.admin<
    { id: string; provenance: string }[]
  >`select id,provenance from operations.signature_evidence where agreement_id=${signed.id} and revision=${signed.revision}`;
  const pack = createDesignedWelcomePack("website_build");
  const resolved = resolveWelcomePack(
    pack,
    {
      client_name: "Signing Test",
      contact_first_name: "Alex",
      agreement_goal: fixture.draft.goals,
      agreement_scope: fixture.draft.scope,
      sender_name: "FSS delivery",
    },
    48,
  );
  const approvalId = randomUUID();
  const journeyId = randomUUID();
  try {
    await fixture.admin.begin(async (tx) => {
      const [existing] = await tx<
        { draftVersion: number }[]
      >`select draft_version as "draftVersion" from operations.welcome_packs where id='website_build' for update`;
      const version = existing.draftVersion + 1;
      const [published] = await tx<
        { id: string }[]
      >`insert into operations.welcome_pack_versions(pack_id,version,title,content,published_by,review_reference)
         values('website_build',${version},'Website Build',${tx.json(pack)},${fixture.founder.actorId},'post-signature-integration') returning id`;
      await tx`update operations.welcome_packs set draft_version=${version},published_version=${version} where id='website_build'`;
      const input = welcomeFixtureInput(fixture.identities[0].email);
      const prepared = await prepareWelcome({
        ...input,
        content: {
          ...input.content,
          journeyPhase: "post_signature",
          rendererVersion: 2,
          edition: "website_build",
          welcomePackVersionId: published.id,
          emailSubject: resolved.emailSubject,
          emailBody: resolved.emailBody,
          pages: resolved.guide,
        },
        thankYou: resolved.thankYou,
      });
      const snapshot = {
        ...prepared.snapshot,
        postSignature: {
          evidenceId: evidence.id,
          revision: signed.revision,
          provenance: evidence.provenance,
          recipientRole: "owner",
          portalUrl: "https://example.test/",
        },
      };
      const json = JSON.stringify(snapshot);
      await tx`select set_config('operations.actor_id',${fixture.founder.actorId},true)`;
      const [started] = await tx<
        { id: string }[]
      >`select operations.start_onboarding(${approvalId},${journeyId},${fixture.organisationId},${signed.id},${json}::text::jsonb,${prepared.pdf},encode(sha256(convert_to(${json}::text::jsonb::text,'UTF8')||${prepared.pdf}),'hex')) as id`;
      assert.equal(started.id, journeyId);
      await tx`update operations.onboarding_journeys set welcome_accepted_at='2026-10-11T10:00:00Z' where id=${journeyId}`;
      const [welcomeJob] = await tx<
        { id: string; idempotencyKey: string }[]
      >`select id,idempotency_key as "idempotencyKey" from operations.onboarding_jobs where journey_id=${journeyId} and step='welcome'`;
      const [beforeDelivery] = await tx<
        { value: number }[]
      >`select count(*)::integer as value from operations.onboarding_jobs where journey_id=${journeyId}`;
      assert.equal(beforeDelivery.value, 1);
      await tx`insert into operations.onboarding_effects(job_id,organisation_id,idempotency_key,first_attempt_at,status)
        values(${welcomeJob.id},${fixture.organisationId},${welcomeJob.idempotencyKey},clock_timestamp(),'unknown_outcome')`;
      await tx.unsafe("set local role operations_onboarding_worker");
      const [earlyDelivery] = await tx<
        { confirmed: boolean }[]
      >`select operations.confirm_onboarding_delivery('test-account','delivery-1',${welcomeJob.id},'email-123') as confirmed`;
      assert.equal(earlyDelivery.confirmed, true);
      await tx.unsafe("reset role");
      const [stillWaiting] = await tx<
        { value: number }[]
      >`select count(*)::integer as value from operations.onboarding_jobs where journey_id=${journeyId}`;
      assert.equal(stillWaiting.value, 1);
      await tx`update operations.onboarding_effects set status='succeeded',receipt=${tx.json({ providerId: "email-123", acceptedAt: "2026-10-11T10:00:00Z" })} where job_id=${welcomeJob.id}`;
      const [journey] = await tx<
        { journeyMode: string; due: Date; delivered: Date }[]
      >`select journey_mode as "journeyMode",post_signature_due_at as due,welcome_delivered_at as delivered from operations.onboarding_journeys where id=${journeyId}`;
      assert.equal(journey.journeyMode, "post_signature");
      assert.equal(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(journey.due),
        "09:00",
      );
      assert.ok(journey.due.getTime() > journey.delivered.getTime());
      assert.ok(
        journey.due.getTime() - journey.delivered.getTime() <=
          25 * 60 * 60 * 1000,
      );
      const jobs = await tx<
        { id: string; step: string; recipient: string; due: Date }[]
      >`select id,step,recipient,due_at as due from operations.onboarding_jobs where journey_id=${journeyId} order by step`;
      assert.deepEqual(
        jobs.map((job) => job.step),
        ["invitation", "invoice", "thank_you", "welcome"],
      );
      assert.ok(
        jobs.every((job) => job.recipient === fixture.identities[0].email),
      );
      assert.ok(
        jobs
          .filter((job) => job.step !== "welcome")
          .every((job) => job.due.toISOString() === journey.due.toISOString()),
      );
      await tx.unsafe("set local role operations_onboarding_worker");
      const [replayedDelivery] = await tx<
        { confirmed: boolean }[]
      >`select operations.confirm_onboarding_delivery('test-account','delivery-1',${welcomeJob.id},'email-123') as confirmed`;
      assert.equal(replayedDelivery.confirmed, false);
      await tx.unsafe("reset role");
      const [count] = await tx<
        { value: number }[]
      >`select count(*)::integer as value from operations.onboarding_jobs where journey_id=${journeyId}`;
      assert.equal(count.value, 4);
      const invoiceJob = jobs.find((job) => job.step === "invoice");
      const accessJob = jobs.find((job) => job.step === "invitation");
      assert.ok(invoiceJob && accessJob);
      const invoiceToken = randomUUID();
      const accessToken = randomUUID();
      await tx`update operations.onboarding_jobs set state='leased',lease_token=${invoiceToken},lease_until=clock_timestamp()+interval '2 minutes' where id=${invoiceJob.id}`;
      await tx`update operations.onboarding_jobs set state='leased',lease_token=${accessToken},lease_until=clock_timestamp()+interval '2 minutes' where id=${accessJob.id}`;
      await tx.unsafe("set local role operations_onboarding_worker");
      const [billing] = await tx<
        { context: { schedule: { id: string; revision: number } } }[]
      >`select operations.onboarding_billing_context(${invoiceJob.id},${invoiceToken},1) as context`;
      const [reusedBilling] = await tx<
        { context: { schedule: { id: string } } }[]
      >`select operations.onboarding_billing_context(${invoiceJob.id},${invoiceToken},1) as context`;
      assert.equal(billing.context.schedule.revision, signed.revision);
      assert.equal(
        reusedBilling.context.schedule.id,
        billing.context.schedule.id,
      );
      const [access] = await tx<
        { receipt: { providerId: string } }[]
      >`select operations.onboarding_access(${accessJob.id},${accessToken},1,${"a".repeat(64)},${JSON.stringify({ version: "1", ciphertext: "unused" })}::text::jsonb) as receipt`;
      assert.match(access.receipt.providerId, /^membership:/);
      await tx.unsafe("reset role");
      const [scheduleCount] = await tx<
        { value: number }[]
      >`select count(*)::integer as value from operations.billing_schedules where agreement_id=${signed.id}`;
      assert.equal(scheduleCount.value, 1);
      await tx`update operations.memberships set role='viewer' where organisation_id=${fixture.organisationId}`;
      await tx.unsafe("set local role operations_onboarding_worker");
      await assert.rejects(
        tx.savepoint(
          (attempt) =>
            attempt`select operations.onboarding_access(${accessJob.id},${accessToken},1,${"a".repeat(64)},${JSON.stringify({ version: "1", ciphertext: "unused" })}::text::jsonb)`,
        ),
        /Billing access requires founder review/,
      );
      await tx.unsafe("reset role");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
