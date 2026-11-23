import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { buildCampaignCopy } from "../../../lib/growth/campaigns/copy";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import { campaignMonthAnniversary } from "../../../lib/growth/campaigns/time";
import type { CampaignPolicyDefinition } from "../../../lib/growth/campaigns/schemas";
import { assignCampaignVariant } from "../../../lib/growth/campaigns/variants";
import { seedSyntheticDirectSubmission } from "./synthetic-direct-submission";
import { withTransitionClock } from "./reservation-clock";
import {
  beginOutreachSubmission,
  reserveOutreachAttempt,
} from "../../../lib/growth/campaigns/reservation-repository";

type Fixture = {
  business: string;
  contact: string;
  prospect: string;
  sequence: string;
  message: string;
  member: string;
  permission: string;
  proof: string;
  event: string;
  email: string;
  reservationId: string;
  rfc: string;
};
export async function exerciseCrossVersionConfirmation(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    connectionId: string;
    ownerEmail: string;
    now: number;
    founder: FounderSession;
    policy: CampaignPolicyDefinition;
  },
): Promise<void> {
  const [initialClock] = await admin<
    { now: Date }[]
  >`select clock_timestamp() as now`;
  assert.ok(initialClock);
  const utcHour = initialClock.now.getUTCHours();
  const policy = {
    ...input.policy,
    recipientTimezone: utcHour >= 6 && utcHour <= 17 ? "UTC" : "Etc/GMT+12",
  };
  const created = await executeCampaignCommand(
    db,
    {
      type: "create",
      requestId: randomUUID(),
      name: "Cross-version confirmation",
      policy,
    },
    input.founder,
    randomUUID(),
  );
  const campaignId = created.id;
  const fixtures: Fixture[] = [];
  const issue = async (version: number): Promise<Fixture> => {
    const business = randomUUID(),
      contact = randomUUID(),
      prospect = randomUUID(),
      sequence = randomUUID(),
      message = randomUUID(),
      member = randomUUID(),
      permission = randomUUID(),
      proof = randomUUID(),
      event = randomUUID(),
      lease = randomUUID();
    const email = `${randomUUID()}@example.test`;
    const fixture: Fixture = {
      business,
      contact,
      prospect,
      sequence,
      message,
      member,
      permission,
      proof,
      event,
      email,
      reservationId: "",
      rfc: "",
    };
    fixtures.push(fixture);
    await admin`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},${`Cross version ${version}`},'limited_company','active','Test','Test','https://example.test','GB')`;
    await admin`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${email},'https://example.test',now(),'corporate','consent')`;
    await admin`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,${input.ownerEmail})`;
    const recipient = {
      email,
      contactId: contact,
      contactVersion: 1,
      prospectVersion: 1,
    };
    await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,template_snapshot) values (${sequence},${prospect},${contact},'active',${admin.json({ reviewedRecipient: recipient, effectiveRecipient: recipient })})`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim,subject_snapshot,html_snapshot,text_snapshot) values (${message},${sequence},${prospect},${contact},'gmail','outbound',0,'sending',${randomUUID()},${lease},now()+interval '5 minutes','queued',true,'temporary','<p>temporary</p>','temporary')`;
    await admin`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,request_id,status,sequence_id) values (${member},${campaignId},${version},${business},${prospect},${randomUUID()},'active',${sequence})`;
    await admin`insert into growth.source_evidence(prospect_id,source_type,source_url,claim_type,claim_summary,observed_at,verified_at,retention_class,origin,founder_actor_id,request_id,request_hash,contact_id,business_id,contact_version,prospect_version) select ${prospect},'founder_verified','https://example.test',claim,'reviewed',now()-interval '1 minute',now()-interval '1 minute','prospect_research','founder',${input.founder.actorId},${proof},${"a".repeat(64)},${contact},${business},1,1 from unnest(array['contact_email','business_observation']) claim`;
    await executeCampaignCommand(
      db,
      {
        type: "record_permission",
        requestId: event,
        membershipId: member,
        evidenceId: permission,
        basis: "consent",
        provider: "gmail",
        jurisdiction: "GB",
        expiresAt: new Date(input.now + 3600000),
        observedAt: new Date(input.now - 1000),
        explicitOptIn: true,
        summary: "Recipient opted in.",
        reference: { kind: "private", value: "permission" },
        expectedProspectVersion: 1,
        expectedContactVersion: 1,
        proofRequestId: proof,
      },
      input.founder,
      randomUUID(),
    );
    const [source] = await admin<
      { id: string }[]
    >`select id from growth.source_evidence where request_id=${proof} and claim_type='business_observation'`;
    assert.ok(source);
    const [first, second] = input.policy.variants;
    assert.ok(first && second);
    const variantId = assignCampaignVariant({
      businessId: business,
      market: "GB",
      seed: `${campaignId}:${version}`,
      variantIds: [first.id, second.id],
    });
    const variant = input.policy.variants.find((item) => item.id === variantId);
    assert.ok(variant);
    const copy = buildCampaignCopy({
      businessName: `Cross version ${version}`,
      verifiedOwnerName: null,
      verifiedObservation: "reviewed",
      offer: "review",
      previewArtifactId: null,
      previewReviewed: false,
      cta: variant.cta,
    });
    const copySha256 = createHash("sha256")
      .update(JSON.stringify([copy.subject, copy.html, copy.text]))
      .digest("hex");
    await admin`update growth.email_messages set subject_snapshot=${copy.subject},html_snapshot=${copy.html},text_snapshot=${copy.text},controlled_preparation=${admin.json({ version: 1, variantId, variantVersion: variant.version, observationProofId: source.id, permissionId: permission, copySha256 })} where id=${message}`;
    const [baseline] = await admin<
      {
        now: Date;
        unbound: number;
        globalUsed: number;
        accountUsed: number;
        ramp: number;
      }[]
    >`with sample as (select clock_timestamp() as now), usage as (select account_id from growth.outreach_provider_usage where connection_id=${input.connectionId})
      select sample.now,
        (select count(*)::int from growth.outreach_reservations where connection_id is null and status <> 'cancelled') as unbound,
        count(r.id)::int as "globalUsed",
        count(r.id) filter (where r.connection_id=${input.connectionId} or r.account_id=(select account_id from usage))::int as "accountUsed",
        (select ramp from growth.outreach_account_controls where connection_id=${input.connectionId}) as ramp
      from sample left join growth.outreach_reservations r on r.london_day=(sample.now at time zone 'Europe/London')::date and r.status <> 'cancelled'
      group by sample.now`;
    assert.ok(baseline);
    const context = JSON.stringify({
      version,
      timezone: policy.recipientTimezone,
      ...baseline,
    });
    assert.equal(baseline.unbound, 0, context);
    assert.equal(baseline.ramp, 50, context);
    assert.ok(
      baseline.globalUsed < 150 && baseline.accountUsed < baseline.ramp,
      context,
    );
    const clockDb = withTransitionClock(db, baseline.now, baseline.now);
    let reserved: Awaited<ReturnType<typeof reserveOutreachAttempt>>;
    try {
      reserved = await reserveOutreachAttempt(clockDb, {
        messageId: message,
        leaseToken: lease,
        attemptKey: randomUUID(),
      });
    } catch (error) {
      throw new Error(`reservation failed: ${context}`, { cause: error });
    }
    assert.equal(
      reserved.status,
      "ready",
      `${context} result=${JSON.stringify(reserved)}`,
    );
    if (reserved.status !== "ready") throw new Error("reservation missing");
    let issued: Awaited<ReturnType<typeof beginOutreachSubmission>>;
    try {
      issued = await beginOutreachSubmission(clockDb, {
        reservationId: reserved.value.reservationId,
        leaseToken: lease,
        fence: reserved.value.fence,
        fingerprint: reserved.value.preparation.fingerprint,
      });
    } catch (error) {
      throw new Error(`issuance failed: ${context}`, { cause: error });
    }
    assert.equal(
      issued.status,
      "ready",
      `${context} result=${JSON.stringify(issued)}`,
    );
    if (issued.status !== "ready") throw new Error("issuance missing");
    fixture.reservationId = issued.value.reservationId;
    fixture.rfc = issued.value.rfcMessageId;
    await seedSyntheticDirectSubmission(
      db,
      fixture.reservationId,
      `message-${member}`,
      `thread-${member}`,
    );
    return fixture;
  };
  try {
    await executeCampaignCommand(
      db,
      {
        type: "approve",
        requestId: randomUUID(),
        campaignId,
        policyVersion: 1,
      },
      input.founder,
      randomUUID(),
    );
    await executeCampaignCommand(
      db,
      { type: "resume", requestId: randomUUID(), campaignId, policyVersion: 1 },
      input.founder,
      randomUUID(),
    );
    const old = await issue(1);
    await executeCampaignCommand(
      db,
      {
        type: "revise",
        requestId: randomUUID(),
        campaignId,
        policyVersion: 1,
        policy: { ...policy, version: 2 },
      },
      input.founder,
      randomUUID(),
    );
    await executeCampaignCommand(
      db,
      {
        type: "approve",
        requestId: randomUUID(),
        campaignId,
        policyVersion: 2,
      },
      input.founder,
      randomUUID(),
    );
    await executeCampaignCommand(
      db,
      { type: "resume", requestId: randomUUID(), campaignId, policyVersion: 2 },
      input.founder,
      randomUUID(),
    );
    const current = await issue(2);
    const [connection] = await admin<
      { version: number; scopes: string[] }[]
    >`select version,granted_scopes as scopes from growth.integration_connections where id=${input.connectionId}`;
    assert.ok(connection);
    const reader = (fixture: Fixture) => async () => ({
      binding: {
        connectionId: input.connectionId,
        googleSubject: "test-subject",
        grantEpoch: connection.version,
        grantedScopes: connection.scopes,
      },
      client: {
        getProfile: async () => ({
          emailAddress: input.ownerEmail,
          historyId: "200",
        }),
        findByRfcMessageId: async () => ({
          messageId: `message-${fixture.member}`,
          gmailThreadId: `thread-${fixture.member}`,
          historyId: "200",
          labelIds: ["SENT"],
          receivedAt: new Date(input.now - 1000).toISOString(),
          from: input.ownerEmail,
          to: fixture.email,
          cc: null,
          bcc: null,
          inReplyTo: null,
          references: null,
          subject: "subject",
          rfcMessageId: fixture.rfc,
          autoSubmitted: null,
          precedence: null,
          returnPath: null,
          autoResponseSuppress: null,
        }),
      },
    });
    let signalReached: (() => void) | undefined,
      releaseBarrier: (() => void) | undefined;
    const reached = new Promise<void>((resolve) => {
      signalReached = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const delayed = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== "begin")
          return Reflect.get(target, property, receiver);
        return async (
          operation: (tx: GrowthTransaction) => Promise<unknown>,
        ) => {
          signalReached?.();
          await barrier;
          return target.begin(operation);
        };
      },
    });
    const oldPending = createGmailConfirmation(
      delayed,
      reader(old),
    )(old.reservationId);
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          reached,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("confirmation barrier not reached")),
              5000,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      const newer = await createGmailConfirmation(
        db,
        reader(current),
      )(current.reservationId);
      assert.equal(newer.status, "ready");
      if (newer.status !== "ready")
        throw new Error("newer confirmation missing");
      releaseBarrier?.();
      const older = await oldPending;
      assert.equal(older.status, "ready");
      if (older.status !== "ready")
        throw new Error("older confirmation missing");
      assert.ok(older.value.anchor.observedAt < newer.value.anchor.observedAt);
      const [job] = await admin<
        {
          count: number;
          version: number;
          anchor: string;
          revision: number;
          due: Date;
          state: string;
        }[]
      >`select (select count(*)::int from growth.outreach_jobs where campaign_id=${campaignId} and job_type='monthly_report') as count,policy_version as version,anchor_reservation_id as anchor,anchor_revision as revision,due_at as due,status as state from growth.outreach_jobs where campaign_id=${campaignId} and job_type='monthly_report' and membership_id is null`;
      assert.ok(job);
      assert.equal(job.count, 1);
      assert.equal(job.version, 1);
      assert.equal(job.anchor, old.reservationId);
      assert.equal(job.revision, 2);
      assert.equal(job.state, "pending");
      assert.equal(
        job.due.getTime(),
        campaignMonthAnniversary(older.value.anchor.observedAt).getTime(),
      );
      const members = await admin<
        { version: number; frozen: string; held: number }[]
      >`select m.policy_version as version,m.confirmed_snapshot->>'policyVersion' as frozen,(select count(*)::int from growth.outreach_jobs j where j.membership_id=m.id and j.job_type='follow_up' and j.status='held') as held from growth.campaign_memberships m where m.id in (${old.member},${current.member}) order by m.policy_version`;
      assert.deepEqual(
        [...members],
        [
          { version: 1, frozen: "1", held: 2 },
          { version: 2, frozen: "2", held: 0 },
        ],
      );
    } finally {
      releaseBarrier?.();
      await Promise.allSettled([oldPending]);
    }
  } finally {
    await admin`delete from growth.outreach_jobs where campaign_id=${campaignId}`;
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaignId})`;
    await admin`delete from growth.outreach_events where campaign_id=${campaignId}`;
    await admin.begin(async (tx) => {
      await tx`alter table growth.campaign_memberships disable trigger protect_campaign_confirmation`;
      await tx`update growth.campaign_memberships set first_confirmation_reservation_id=null,confirmed_snapshot=null,current_permission_id=null where campaign_id=${campaignId}`;
      await tx`alter table growth.campaign_memberships enable trigger protect_campaign_confirmation`;
    });
    await admin`delete from growth.audit_log where entity_id in (select id::text from growth.outreach_reservations where campaign_id=${campaignId}) or (entity_type='campaign' and entity_id=${campaignId})`;
    await admin`delete from growth.outreach_reservations where campaign_id=${campaignId}`;
    await admin`delete from growth.outreach_permissions where membership_id in (select id from growth.campaign_memberships where campaign_id=${campaignId})`;
    await admin`delete from growth.campaign_memberships where campaign_id=${campaignId}`;
    for (const fixture of fixtures) {
      await admin`delete from growth.email_messages where sequence_enrollment_id=${fixture.sequence}`;
      await admin`delete from growth.sequence_enrollments where id=${fixture.sequence}`;
      await admin.begin(async (tx) => {
        await tx`alter table growth.source_evidence disable trigger protect_founder_source_evidence`;
        await tx`delete from growth.source_evidence where request_id=${fixture.proof}`;
        await tx`alter table growth.source_evidence enable trigger protect_founder_source_evidence`;
      });
      await admin`delete from growth.prospects where id=${fixture.prospect}`;
      await admin`delete from growth.contacts where id=${fixture.contact}`;
      await admin`delete from growth.businesses where id=${fixture.business}`;
    }
    await admin`delete from growth.campaigns where id=${campaignId}`;
  }
}
