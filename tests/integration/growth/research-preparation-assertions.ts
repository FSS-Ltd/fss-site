import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { loadReviewMembershipPreparationAuthority } from "../../../lib/growth/campaigns/founder-verification-reader";
import { prepareFirstMessage } from "../../../lib/growth/campaigns/prepare-first-message";
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
  try {
    const evidenceId = randomUUID();
    const eventId = randomUUID();
    await executeCampaignCommand(
      db,
      {
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
      },
      input.founder,
      randomUUID(),
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
    } finally {
      await admin`drop trigger test_prepare_audit_failure on growth.audit_log`;
      await admin`drop function growth.test_prepare_audit_failure()`;
    }
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
      [false, true],
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
  } finally {
    const [memberRow] = await admin<
      { sequenceId: string | null }[]
    >`select sequence_id as "sequenceId" from growth.campaign_memberships where id=${member.id}`;
    if (memberRow?.sequenceId) {
      await admin`update growth.campaign_memberships set sequence_id=null where id=${member.id}`;
      await admin`update growth.sequence_enrollments set first_message_id=null where id=${memberRow.sequenceId}`;
      await admin`delete from growth.email_messages where sequence_enrollment_id=${memberRow.sequenceId}`;
      await admin`delete from growth.sequence_enrollments where id=${memberRow.sequenceId}`;
    }
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where membership_id=${member.id})`;
    await admin`delete from growth.outreach_events where membership_id=${member.id}`;
    await admin`update growth.campaign_memberships set current_permission_id=null where id=${member.id}`;
    await admin`delete from growth.outreach_permissions where membership_id=${member.id}`;
    await admin`delete from growth.campaign_memberships where id=${member.id}`;
  }
}
