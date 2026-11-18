import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { executeCrmCommand } from "../../../lib/growth/crm/commands";
import { verifyFounderEvidence } from "../../../lib/growth/campaigns/founder-verification";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import {
  loadLatestCampaignPolicy,
  persistCampaignMembership,
} from "../../../lib/growth/campaigns/repository";
import { appendCampaignEventAndOutbox } from "../../../lib/growth/campaigns/events";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";

const connection = process.env.DIRECT_DATABASE_URL;
test(
  "campaign approval is versioned, paused and replay-safe",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const db = postgres(connection, {
      max: 4,
      connection: { options: "-c role=growth_app" },
    });
    const email = "j.ntagengwa@faithfulsoftware.dev";
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const now = Date.now();
    const attestation = {
      summary: "Founder reviewed the documented basis.",
      reference: { kind: "private" as const, value: "record-1" },
      observedAt: new Date(now - 1000),
      expiresAt: new Date(now + 86400000),
    };
    const policy = {
      version: 1,
      accountConnectionId: null,
      status: "paused" as const,
      approvedAt: null,
      approverId: null,
      effectiveAt: new Date(now - 1000),
      expiresAt: new Date(now + 86400000),
      offer: "review",
      capabilityEvidence: "record-1",
      jurisdiction: "GB",
      provider: "gmail" as const,
      permissionRequirement: "consent" as const,
      recipientTimezone: "Europe/London",
      sendWeekdays: [1, 2, 3, 4, 5],
      windowStart: "09:00",
      windowEnd: "17:00",
      dailyLimit: 25 as const,
      providerReserve: 50,
      haltThresholds: { hardBounces: 1, complaints: 1 },
      variants: [
        { id: "a", version: 1, cta: "Would this help?" },
        { id: "b", version: 1, cta: "May I send details?" },
      ],
      cadenceFamily: "review" as const,
      capabilityAttestation: attestation,
      providerAttestation: {
        ...attestation,
        provider: "gmail" as const,
        jurisdiction: "GB",
        confirmed: true as const,
      },
    };
    try {
      const create = {
        type: "create" as const,
        requestId: randomUUID(),
        name: `test-${randomUUID()}`,
        policy,
      };
      const [first, replay] = await Promise.all([
        executeCampaignCommand(db, create, founder, randomUUID()),
        executeCampaignCommand(db, create, founder, randomUUID()),
      ]);
      assert.equal(first.id, replay.id);
      await assert.rejects(
        executeCampaignCommand(
          db,
          { ...create, name: "changed" },
          founder,
          randomUUID(),
        ),
      );
      const approve = await executeCampaignCommand(
        db,
        {
          type: "approve",
          requestId: randomUUID(),
          campaignId: first.id,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      );
      assert.equal(approve.version, 1);
      const [row] =
        await db`select status,approved_by,approved_at from growth.campaigns where id=${first.id} and version=1`;
      assert.equal(row?.status, "paused");
      assert.equal(row?.approved_by, founder.actorId);
      assert.ok(row?.approved_at);
      await assert.rejects(
        loadLatestCampaignPolicy(db, first.id, { ...founder, actorId: "bad" }),
      );

      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "resume",
            requestId: randomUUID(),
            campaignId: first.id,
            policyVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /provider_health_unknown/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "pause",
            requestId: randomUUID(),
            campaignId: first.id,
            policyVersion: 1,
          },
          { ...founder, actorId: "bad" },
          randomUUID(),
        ),
      );
      const token = randomUUID();
      const lead = await executeCrmCommand(
        db,
        {
          kind: "capture_source",
          requestId: randomUUID(),
          sourceType: "facebook_page",
          sourceUrl: `https://facebook.com/${token}`,
          businessName: `member-${token}`,
          countryCode: "GB",
          corporateType: null,
          registrationNumber: null,
          firstName: null,
          lastName: null,
          email: null,
          opportunity: "Review",
          offer: "Review",
          observedAt: new Date(),
        },
        founder,
        randomUUID(),
      );
      assert.ok(lead.prospectId);
      const verification = await verifyFounderEvidence(
        db,
        {
          requestId: randomUUID(),
          prospectId: lead.prospectId,
          expectedProspectVersion: 1,
          email: `${token}@example.com`,
          firstName: null,
          lastName: null,
          contactSourceUrl: `https://${token}.example.com/contact`,
          contactObservedAt: new Date(),
          observationSourceUrl: `https://${token}.example.com`,
          observation: "Telephone booking is listed.",
          observedAt: new Date(),
        },
        founder,
        randomUUID(),
      );
      const [legacy] = await db<
        { id: string }[]
      >`insert into growth.sequence_enrollments(prospect_id,contact_id,status) values (${lead.prospectId},${verification.contactId},'active') returning id`;
      assert.ok(legacy);
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "enrol",
            requestId: randomUUID(),
            campaignId: first.id,
            policyVersion: 1,
            prospectId: lead.prospectId,
          },
          founder,
          randomUUID(),
        ),
        /active_membership_exists/,
      );
      await db`update growth.sequence_enrollments set status='stopped_rejected' where id=${legacy.id}`;
      const secondCampaign = await executeCampaignCommand(
        db,
        {
          ...create,
          requestId: randomUUID(),
          name: `other-${token}`,
          policy: { ...policy, dailyLimit: 150 },
        },
        founder,
        randomUUID(),
      );
      const [ceiling] =
        await db`select policy->>'dailyLimit' as value,status from growth.campaigns where id=${secondCampaign.id}`;
      assert.equal(ceiling?.value, "150");
      assert.equal(ceiling?.status, "paused");
      await executeCampaignCommand(
        db,
        {
          type: "approve",
          requestId: randomUUID(),
          campaignId: secondCampaign.id,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      );
      const suppressedToken = randomUUID();
      const suppressedEmail = `${suppressedToken}@example.com`;
      const suppressedLead = await executeCrmCommand(
        db,
        {
          kind: "capture_source",
          requestId: randomUUID(),
          sourceType: "facebook_page",
          sourceUrl: `https://facebook.com/${suppressedToken}`,
          businessName: `suppressed-${suppressedToken}`,
          countryCode: "GB",
          corporateType: null,
          registrationNumber: null,
          firstName: null,
          lastName: null,
          email: suppressedEmail,
          opportunity: "Review",
          offer: "Review",
          observedAt: new Date(),
        },
        founder,
        randomUUID(),
      );
      assert.ok(suppressedLead.prospectId);
      await db`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${suppressedEmail},'opt out','test',${founder.actorId})`;
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "enrol",
            requestId: randomUUID(),
            campaignId: secondCampaign.id,
            policyVersion: 1,
            prospectId: suppressedLead.prospectId,
          },
          founder,
          randomUUID(),
        ),
        /excluded/,
      );
      const prospectId = lead.prospectId;
      const enrolRequests = [first.id, secondCampaign.id].map((campaignId) => ({
        type: "enrol" as const,
        requestId: randomUUID(),
        campaignId,
        policyVersion: 1,
        prospectId,
      }));
      const race = await Promise.allSettled(
        enrolRequests.map((command) =>
          executeCampaignCommand(db, command, founder, randomUUID()),
        ),
      );
      const successes = race.filter((entry) => entry.status === "fulfilled");
      assert.equal(successes.length, 1);
      const member = successes[0];
      assert.ok(member && member.status === "fulfilled");
      const [membership] = await db<
        { campaignId: string }[]
      >`select campaign_id as "campaignId" from growth.campaign_memberships where id=${member.value.id}`;
      assert.ok(membership);
      const winningCampaignId = membership.campaignId;
      const winningRequest = enrolRequests.find(
        (request) => request.campaignId === winningCampaignId,
      );
      assert.ok(winningRequest);
      const replayedMembership = await withGrowthTransaction(db, (tx) =>
        persistCampaignMembership(tx, {
          ...winningRequest,
          founder,
          correlationId: randomUUID(),
        }),
      );
      assert.equal(replayedMembership.membershipId, member.value.id);
      await assert.rejects(
        withGrowthTransaction(db, (tx) =>
          persistCampaignMembership(tx, {
            ...winningRequest,
            founder: { ...founder, actorId: "bad" },
            correlationId: randomUUID(),
          }),
        ),
      );
      const [membershipEventCount] =
        await db`select count(*)::int as count from growth.outreach_events where membership_id=${member.value.id} and event_type='enrol'`;
      assert.equal(membershipEventCount?.count, 1);

      const permission = {
        type: "record_permission" as const,
        requestId: randomUUID(),
        membershipId: member.value.id,
        evidenceId: randomUUID(),
        basis: "consent" as const,
        provider: "gmail" as const,
        jurisdiction: "GB",
        expiresAt: new Date(now + 86400000),
        observedAt: new Date(),
        explicitOptIn: true,
        summary: "Recipient requested contact directly.",
        reference: { kind: "private" as const, value: "permission-record" },
        expectedProspectVersion: verification.prospectVersion,
        expectedContactVersion: verification.contactVersion,
        proofRequestId: verification.alreadyExisted ? randomUUID() : "",
      };
      const [proof] = await db<
        { requestId: string }[]
      >`select request_id as "requestId" from growth.source_evidence where origin='founder' and prospect_id=${lead.prospectId} limit 1`;
      assert.ok(proof);
      permission.proofRequestId = proof.requestId;
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...permission,
            requestId: randomUUID(),
            evidenceId: randomUUID(),
            explicitOptIn: false,
          },
          founder,
          randomUUID(),
        ),
        /permission_invalid/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...permission,
            requestId: randomUUID(),
            evidenceId: randomUUID(),
            jurisdiction: "FR",
          },
          founder,
          randomUUID(),
        ),
        /permission_invalid/,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            ...permission,
            requestId: randomUUID(),
            evidenceId: randomUUID(),
            proofRequestId: randomUUID(),
          },
          founder,
          randomUUID(),
        ),
        /verification_required/,
      );
      const saved = await executeCampaignCommand(
        db,
        permission,
        founder,
        randomUUID(),
      );
      const [storedProof] = await db<
        { origin: string | null }[]
      >`select proof_origin as origin from growth.outreach_permissions where id=${permission.evidenceId}`;
      assert.equal(storedProof?.origin, "founder");
      const repeated = await executeCampaignCommand(
        db,
        permission,
        founder,
        randomUUID(),
      );
      assert.equal(repeated.id, saved.id);
      const renewed = await executeCampaignCommand(
        db,
        { ...permission, requestId: randomUUID(), evidenceId: randomUUID() },
        founder,
        randomUUID(),
      );
      assert.notEqual(renewed.id, saved.id);
      await assert.rejects(db`insert into growth.outreach_permissions(id,membership_id,basis,provider,jurisdiction,expires_at,actor_id,evidence,contact_version,prospect_version,contact_id,proof_request_id)
        select ${randomUUID()},membership_id,basis,provider,jurisdiction,expires_at,actor_id,evidence,contact_version,prospect_version,contact_id,null from growth.outreach_permissions where id=${saved.id}`);
      const [count] =
        await db`select count(*)::int as count from growth.outreach_permissions where membership_id=${member.value.id}`;
      assert.equal(count?.count, 2);
      const [queued] =
        await db`select count(*)::int as count from growth.outreach_jobs where membership_id=${member.value.id}`;
      assert.equal(queued?.count, 0);
      const eventId = randomUUID();
      await assert.rejects(
        db.begin(async (tx) => {
          await appendCampaignEventAndOutbox(tx, {
            campaignId: winningCampaignId,
            version: 1,
            membershipId: member.value.id,
            resultId: member.value.id,
            requestId: eventId,
            requestHash: "a".repeat(64),
            type: "pause",
            founder,
            correlationId: randomUUID(),
          });
          const [outside] =
            await db`select count(*)::int as count from growth.outreach_events where id=${eventId}`;
          assert.equal(outside?.count, 0);
          throw new Error("rollback");
        }),
        /rollback/,
      );
      const [afterRollback] =
        await db`select count(*)::int as count from growth.outreach_events where id=${eventId}`;
      assert.equal(afterRollback?.count, 0);
      await db`insert into growth.outreach_jobs(campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key,status,lease_owner,lease_until) values (${winningCampaignId},1,${member.value.id},'follow_up',now(),${randomUUID()},'leased','worker',now()+interval '1 minute')`;
      const reportJobId = randomUUID();
      await db`insert into growth.outreach_jobs(id,campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key,status) values (${reportJobId},${winningCampaignId},1,${member.value.id},'monthly_report',now(),${randomUUID()},'pending')`;
      await executeCampaignCommand(
        db,
        {
          type: "pause",
          requestId: randomUUID(),
          campaignId: winningCampaignId,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      );
      const jobs = await db<
        { jobType: string; status: string }[]
      >`select job_type as "jobType",status from growth.outreach_jobs where membership_id=${member.value.id} order by job_type`;
      assert.deepEqual(
        [...jobs],
        [
          { jobType: "follow_up", status: "cancelled" },
          { jobType: "monthly_report", status: "pending" },
        ],
      );
      await db`update growth.outreach_jobs set status='completed' where id=${reportJobId}`;
      const revision = await executeCampaignCommand(
        db,
        {
          type: "revise",
          requestId: randomUUID(),
          campaignId: winningCampaignId,
          policyVersion: 1,
          policy: { ...policy, version: 2 },
        },
        founder,
        randomUUID(),
      );
      assert.equal(revision.version, 2);
      const [newPolicy] =
        await db`select status,approved_by from growth.campaigns where id=${winningCampaignId} and version=2`;
      assert.equal(newPolicy?.status, "paused");
      assert.equal(newPolicy?.approved_by, null);
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "approve",
            requestId: randomUUID(),
            campaignId: winningCampaignId,
            policyVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /policy_version_changed/,
      );
      await executeCampaignCommand(
        db,
        {
          type: "stop",
          requestId: randomUUID(),
          membershipId: member.value.id,
        },
        founder,
        randomUUID(),
      );
    } finally {
      await db.end();
    }
  },
);
