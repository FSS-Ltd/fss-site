import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { loadReviewMembershipPreparationAuthority } from "../../../lib/growth/campaigns/founder-verification-reader";
import {
  prepareFirstMessage,
  prepareFirstMessageForJob,
} from "../../../lib/growth/campaigns/prepare-first-message";
import { runFirstPreparationBatch } from "../../../lib/growth/campaigns/first-preparation-worker";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createGlobalResearchFixture } from "../../../lib/growth/research/global-test-fixture";
import { globalResearchRunSchema } from "../../../lib/growth/research/global-schema";

export async function exerciseResearchPreparation(
  admin: GrowthDb,
  db: GrowthDb,
  input: { campaignId: string; connectionId: string; founder: FounderSession },
): Promise<void> {
  const fixture = createGlobalResearchFixture();
  const candidate = fixture.prospects[0];
  if (!candidate || !candidate.evidence[0])
    throw new Error("Missing fixture evidence.");
  const id = randomUUID();
  const url = `https://${id}.example.test/contact`;
  const email = `office@${id}.example.test`;
  const when = new Date(Date.now() - 60000).toISOString();
  const evidence = {
    ...candidate.evidence[0],
    sourceUrl: url,
    observedAt: when,
    verifiedAt: when,
  };
  const run = globalResearchRunSchema.parse({
    ...fixture,
    externalRunId: id,
    prospects: [
      {
        ...candidate,
        business: {
          ...candidate.business,
          countryCode: "GB",
          websiteUrl: url,
          firstPartySourceUrl: url,
          verifiedAt: when,
        },
        contact: {
          ...candidate.contact,
          email,
          emailSourceUrl: url,
          emailVerifiedAt: when,
        },
        evidence: [
          { ...evidence, claimType: "contact_email" },
          {
            ...evidence,
            claimType: "business_observation",
            claimSummary: "Customers request appointments by telephone.",
          },
        ],
        proof: {
          purpose: "campaign_source_proof",
          contactEmail: { evidenceIndex: 0, email },
          businessObservation: { evidenceIndex: 1 },
        },
      },
    ],
  });
  const ingested = await ingestResearchRun(db, run, {
    kind: "signed_research",
    keyId: "test-agent",
    bodySha256: "a".repeat(64),
  });
  const prospectId = ingested.acceptedProspects[0]?.prospectId;
  if (!prospectId) throw new Error("Research candidate was not accepted.");
  const [binding] = await db<
    { id: string }[]
  >`select id from growth.research_source_proof_bindings where research_run_id=${ingested.runId} and prospect_id=${prospectId}`;
  if (!binding) throw new Error("Research binding missing.");
  const member = await executeCampaignCommand(
    db,
    {
      type: "enrol",
      requestId: randomUUID(),
      campaignId: input.campaignId,
      policyVersion: 2,
      prospectId,
    },
    input.founder,
    randomUUID(),
  );
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("unexpected provider request");
  };
  try {
    const evidenceId = randomUUID();
    const eventId = randomUUID();
    const firstPermission = {
      type: "record_permission",
      requestId: eventId,
      membershipId: member.id,
      evidenceId,
      basis: "consent",
      provider: "gmail",
      jurisdiction: "GB",
      expiresAt: new Date(Date.now() + 3600000),
      observedAt: new Date(Date.now() - 1000),
      explicitOptIn: true,
      summary: "Recipient opted in.",
      reference: { kind: "private", value: "record" },
      expectedProspectVersion: 1,
      expectedContactVersion: 1,
      researchProofId: binding.id,
    } as const;
    await executeCampaignCommand(
      db,
      firstPermission,
      input.founder,
      randomUUID(),
    );
    assert.equal(
      (
        await executeCampaignCommand(
          db,
          firstPermission,
          input.founder,
          randomUUID(),
        )
      ).alreadyExisted,
      true,
    );
    const [firstJob] = await admin<
      { id: string }[]
    >`select j.id from growth.outreach_jobs j join growth.outreach_outbox o on o.id=j.outbox_id where o.event_id=${eventId} and j.job_type='first_preparation'`;
    assert.ok(firstJob);
    await admin`delete from growth.outreach_jobs where id=${firstJob.id}`;
    assert.equal(
      (
        await executeCampaignCommand(
          db,
          firstPermission,
          input.founder,
          randomUUID(),
        )
      ).alreadyExisted,
      true,
    );
    const [recovered] = await admin<
      { count: number }[]
    >`select count(*)::int as count from growth.outreach_jobs j join growth.outreach_outbox o on o.id=j.outbox_id where o.event_id=${eventId} and j.job_type='first_preparation'`;
    assert.equal(recovered?.count, 1);
    await assert.rejects(
      executeCampaignCommand(
        db,
        { ...firstPermission, summary: "Different evidence." },
        input.founder,
        randomUUID(),
      ),
      /request_conflict/,
    );
    const prepare = (runId: string) =>
      withGrowthTransaction(db, (tx) =>
        loadReviewMembershipPreparationAuthority(tx, {
          membershipId: member.id,
          connectionId: input.connectionId,
          source: { kind: "research_run", runId },
        }),
      );
    assert.equal((await prepare(ingested.runId))?.proof.origin, "research");
    const prepareEvent = (event: string) =>
      withGrowthTransaction(db, (tx) =>
        loadReviewMembershipPreparationAuthority(tx, {
          membershipId: member.id,
          connectionId: input.connectionId,
          source: { kind: "permission_event", eventId: event },
        }),
      );
    assert.equal((await prepareEvent(eventId))?.proof.origin, "research");
    assert.equal(await prepareEvent(randomUUID()), null);
    await admin`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','false'::jsonb) where id=${evidenceId}`;
    assert.equal(await prepareEvent(eventId), null);
    await admin`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','true'::jsonb) where id=${evidenceId}`;
    const nextEvent = randomUUID();
    await executeCampaignCommand(
      db,
      {
        type: "record_permission",
        requestId: nextEvent,
        membershipId: member.id,
        evidenceId: randomUUID(),
        basis: "consent",
        provider: "gmail",
        jurisdiction: "GB",
        expiresAt: new Date(Date.now() + 3600000),
        observedAt: new Date(Date.now() - 1000),
        explicitOptIn: true,
        summary: "Recipient renewed consent.",
        reference: { kind: "private", value: "new-record" },
        expectedProspectVersion: 1,
        expectedContactVersion: 1,
        researchProofId: binding.id,
      },
      input.founder,
      randomUUID(),
    );
    assert.equal(await prepareEvent(eventId), null);
    assert.equal((await prepareEvent(nextEvent))?.proof.origin, "research");
    const jobs = await admin<{ id: string; eventId: string }[]>`
      select j.id,o.event_id as "eventId" from growth.outreach_jobs j join growth.outreach_outbox o on o.id=j.outbox_id
      where j.membership_id=${member.id} and j.job_type='first_preparation' order by j.due_at,j.id`;
    assert.equal(jobs.length, 2);
    assert.deepEqual(
      new Set(jobs.map((job) => job.eventId)),
      new Set([eventId, nextEvent]),
    );

    assert.equal(await prepare(randomUUID()), null);
    await admin`update growth.prospects set version=version+1 where id=${prospectId}`;
    assert.equal(await prepare(ingested.runId), null);
    const preparation = {
      membershipId: member.id,
      connectionId: input.connectionId,
      permissionEventId: nextEvent,
    };
    assert.deepEqual(await prepareFirstMessage(db, preparation), {
      status: "held",
      reason: "preparation_not_authorized",
    });
    await admin`update growth.prospects set version=version-1 where id=${prospectId}`;
    assert.deepEqual(
      await prepareFirstMessage(db, {
        ...preparation,
        permissionEventId: eventId,
      }),
      { status: "held", reason: "preparation_not_authorized" },
    );
    await admin`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${email},'opt_out','manual','test')`;
    assert.deepEqual(await prepareFirstMessage(db, preparation), {
      status: "held",
      reason: "preparation_not_authorized",
    });
    await admin`delete from growth.suppressions where normalised_email=${email}`;
    const organisationId = randomUUID();
    await admin`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference)
      select ${organisationId},b.legal_name,b.legal_name,'active','Europe/London',${input.founder.actorId},'synthetic'
      from growth.prospects p join growth.businesses b on b.id=p.business_id where p.id=${prospectId}`;
    assert.deepEqual(await prepareFirstMessage(db, preparation), {
      status: "held",
      reason: "preparation_not_authorized",
    });
    await admin`delete from operations.audit_events where organisation_id=${organisationId}`;
    await admin`delete from operations.organisations where id=${organisationId}`;
    const priorSequence = randomUUID();
    await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status)
      select ${priorSequence},p.id,p.primary_contact_id,'completed' from growth.prospects p where p.id=${prospectId}`;
    assert.deepEqual(await prepareFirstMessage(db, preparation), {
      status: "held",
      reason: "identity_changed",
    });
    await admin`delete from growth.sequence_enrollments where id=${priorSequence}`;
    await admin`create function growth.test_prepare_audit_failure() returns trigger language plpgsql as $$ begin if new.action='campaign.first_message_prepared' then raise exception 'test prepare audit failure'; end if; return new; end $$`;
    await admin`create trigger test_prepare_audit_failure before insert on growth.audit_log for each row execute function growth.test_prepare_audit_failure()`;
    const [credential] = await admin<
      { subject: string; epoch: number; scopes: string[] }[]
    >`
      select google_subject as subject,version as epoch,granted_scopes as scopes from growth.integration_connections where id=${input.connectionId}`;
    assert.ok(credential);
    const grant = {
      connectionId: input.connectionId,
      googleSubject: credential.subject,
      grantEpoch: credential.epoch,
      grantedScopes: credential.scopes,
    };
    const currentJob = jobs.find((item) => item.eventId === nextEvent);
    assert.ok(currentJob);
    await admin`update growth.outreach_jobs set status='leased',lease_owner='grant-test',lease_revision=lease_revision+1,lease_until=clock_timestamp()+interval '1 minute' where id=${currentJob.id}`;
    const [grantLease] = await admin<
      { revision: string }[]
    >`select lease_revision::text as revision from growth.outreach_jobs where id=${currentJob.id}`;
    assert.ok(grantLease);
    assert.deepEqual(
      await prepareFirstMessageForJob(db, {
        jobId: currentJob.id,
        leaseOwner: "grant-test",
        leaseRevision: grantLease.revision,
        binding: { ...grant, googleSubject: "different-subject" },
      }),
      { status: "held", reason: "grant_changed" },
    );
    const [grantHeld] = await admin<
      { status: string; reason: string }[]
    >`select status,last_error_code as reason from growth.outreach_jobs where id=${currentJob.id}`;
    assert.deepEqual(grantHeld, { status: "held", reason: "grant_changed" });
    await admin`update growth.outreach_jobs set status='pending',lease_owner=null,lease_until=null,last_error_code=null where id=${currentJob.id}`;
    await admin`update growth.outreach_account_controls set state='paused' where connection_id=${input.connectionId}`;
    await admin`update growth.outreach_jobs set status='leased',lease_owner='retry-test',lease_revision=lease_revision+1,lease_until=clock_timestamp()+interval '1 minute' where id=${currentJob.id}`;
    const [retryLease] = await admin<
      { revision: string }[]
    >`select lease_revision::text as revision from growth.outreach_jobs where id=${currentJob.id}`;
    assert.ok(retryLease);
    assert.deepEqual(
      await prepareFirstMessageForJob(db, {
        jobId: currentJob.id,
        leaseOwner: "retry-test",
        leaseRevision: retryLease.revision,
        binding: grant,
      }),
      { status: "held", reason: "job_retry" },
    );
    const [retryState] = await admin<
      { status: string; reason: string; future: boolean }[]
    >`select status,last_error_code as reason,due_at>clock_timestamp() as future from growth.outreach_jobs where id=${currentJob.id}`;
    assert.deepEqual(retryState, {
      status: "pending",
      reason: "account_not_active",
      future: true,
    });
    await admin`update growth.outreach_account_controls set state='active' where connection_id=${input.connectionId}`;
    await admin`update growth.outreach_jobs set due_at=clock_timestamp() where id=${currentJob.id}`;
    try {
      await assert.rejects(
        prepareFirstMessage(db, preparation),
        /test prepare audit failure/,
      );
      const [rolledBack] = await admin<
        { status: string; sequenceId: string | null; count: number }[]
      >`
        select status,sequence_id as "sequenceId",(select count(*)::int from growth.sequence_enrollments where prospect_id=${prospectId}) as count
        from growth.campaign_memberships where id=${member.id}`;
      assert.deepEqual(rolledBack, {
        status: "review",
        sequenceId: null,
        count: 0,
      });
      await assert.rejects(
        runFirstPreparationBatch(db, {
          binding: grant,
          workerId: "first-preparation-test",
        }),
        /test prepare audit failure/,
      );
      const [job] = await admin<{ status: string; revision: string }[]>`
        select j.status,j.lease_revision::text as revision from growth.outreach_jobs j join growth.outreach_outbox o on o.id=j.outbox_id
        where o.event_id=${nextEvent} and j.job_type='first_preparation'`;
      assert.equal(job?.status, "leased");
      assert.ok(job);
      await admin`update growth.outreach_jobs set lease_until=clock_timestamp()-interval '1 second' where id=(select j.id from growth.outreach_jobs j join growth.outreach_outbox o on o.id=j.outbox_id where o.event_id=${nextEvent})`;
      assert.deepEqual(
        await prepareFirstMessageForJob(db, {
          jobId: jobs.find((item) => item.eventId === nextEvent)!.id,
          leaseOwner: "first-preparation-test",
          leaseRevision: job.revision,
          binding: grant,
        }),
        { status: "held", reason: "job_lease_invalid" },
      );
    } finally {
      await admin`drop trigger test_prepare_audit_failure on growth.audit_log`;
      await admin`drop function growth.test_prepare_audit_failure()`;
    }
    const workerResult = await runFirstPreparationBatch(db, {
      binding: grant,
      workerId: "first-preparation-test",
    });
    assert.equal(workerResult.prepared, 1);
    const [completed] = await admin<{ id: string; revision: string }[]>`
      select j.id,j.lease_revision::text as revision from growth.outreach_jobs j join growth.outreach_outbox o on o.id=j.outbox_id where o.event_id=${nextEvent} and j.status='completed'`;
    assert.ok(completed);
    assert.deepEqual(
      await prepareFirstMessageForJob(db, {
        jobId: completed.id,
        leaseOwner: "grant-test",
        leaseRevision: grantLease.revision,
        binding: grant,
      }),
      { status: "held", reason: "job_lease_invalid" },
    );
    const replay = await prepareFirstMessageForJob(db, {
      jobId: completed.id,
      leaseOwner: "first-preparation-test",
      leaseRevision: completed.revision,
      binding: grant,
    });
    assert.equal(replay.status, "ready");
    if (replay.status === "ready")
      assert.equal(replay.value.alreadyExisted, true);
    const results = await Promise.all([
      prepareFirstMessage(db, preparation),
      prepareFirstMessage(db, preparation),
    ]);
    assert.ok(results[0]?.status === "ready");
    assert.ok(results[1]?.status === "ready");
    assert.equal(results[0].value.messageId, results[1].value.messageId);
    assert.deepEqual(
      results
        .map(
          (result) => result.status === "ready" && result.value.alreadyExisted,
        )
        .sort(),
      [true, true],
    );
    const [prepared] = await admin<
      {
        status: string;
        sequenceCount: number;
        messageCount: number;
        eventCount: number;
        subject: string;
        snapshot: { permissionId: string };
      }[]
    >`select m.status,(select count(*)::int from growth.sequence_enrollments where prospect_id=m.prospect_id) as "sequenceCount",
      (select count(*)::int from growth.email_messages where sequence_enrollment_id=m.sequence_id) as "messageCount",
      (select count(*)::int from growth.outreach_events where membership_id=m.id and event_type='first_message_prepared') as "eventCount",
      em.subject_snapshot as subject,em.controlled_preparation as snapshot
      from growth.campaign_memberships m join growth.email_messages em on em.sequence_enrollment_id=m.sequence_id and em.step_number=0 where m.id=${member.id}`;
    assert.equal(prepared?.status, "active");
    assert.equal(prepared.sequenceCount, 1);
    assert.equal(prepared.messageCount, 1);
    assert.equal(prepared.eventCount, 1);
    assert.match(prepared.subject, /^A question about /);
    assert.notEqual(prepared.snapshot.permissionId, evidenceId);
    assert.deepEqual(
      await prepareFirstMessage(db, {
        ...preparation,
        permissionEventId: eventId,
      }),
      {
        status: "held",
        reason: "existing_sequence",
      },
    );
    // Synthetic event copies exercise only stage selection and the batch cap.
    for (let index = 0; index < 26; index += 1) {
      const event = randomUUID();
      const outbox = randomUUID();
      await admin`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type,request_id,request_hash,actor_id,result_id)
        select ${event},campaign_id,policy_version,membership_id,event_type,${event},request_hash,actor_id,result_id from growth.outreach_events where id=${nextEvent}`;
      await admin`insert into growth.outreach_outbox(id,event_id) values (${outbox},${event})`;
      await admin`insert into growth.outreach_jobs(campaign_id,policy_version,membership_id,outbox_id,job_type,due_at,idempotency_key)
        select campaign_id,policy_version,membership_id,${outbox},'first_preparation',clock_timestamp(),${`first-preparation:${event}`} from growth.outreach_events where id=${event}`;
    }
    const firstBatch = await runFirstPreparationBatch(db, {
      binding: grant,
      workerId: "cap-test",
    });
    const secondBatch = await runFirstPreparationBatch(db, {
      binding: grant,
      workerId: "cap-test",
    });
    assert.equal(firstBatch.claimed, 25);
    assert.equal(firstBatch.held, 25);
    assert.equal(secondBatch.claimed, 1);
    assert.equal(secondBatch.held, 1);
  } finally {
    globalThis.fetch = savedFetch;
    const [memberRow] = await admin<
      { sequenceId: string | null }[]
    >`select sequence_id as "sequenceId" from growth.campaign_memberships where id=${member.id}`;
    if (memberRow?.sequenceId) {
      await admin`update growth.campaign_memberships set sequence_id=null where id=${member.id}`;
      await admin`update growth.sequence_enrollments set first_message_id=null where id=${memberRow.sequenceId}`;
      await admin`delete from growth.email_messages where sequence_enrollment_id=${memberRow.sequenceId}`;
      await admin`delete from growth.sequence_enrollments where id=${memberRow.sequenceId}`;
    }
    await admin`delete from growth.outreach_jobs where membership_id=${member.id} and job_type='first_preparation'`;
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where membership_id=${member.id})`;
    await admin`delete from growth.outreach_events where membership_id=${member.id}`;
    await admin`update growth.campaign_memberships set current_permission_id=null where id=${member.id}`;
    await admin`delete from growth.outreach_permissions where membership_id=${member.id}`;
    await admin`delete from growth.campaign_memberships where id=${member.id}`;
  }
}
