import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { campaignPolicyDefinitionSchema } from "../../../lib/growth/campaigns/schemas";
import {
  reserveOutreachAttempt,
  beginOutreachSubmission,
} from "../../../lib/growth/campaigns/reservation-repository";

export async function exerciseCampaignReservation(
  admin: GrowthDb,
  db: GrowthDb,
  input: { id: string; email: string; now: number; founder: FounderSession },
): Promise<void> {
  const { id, email, now, founder } = input;
  const attestation = {
    summary: "reviewed",
    reference: { kind: "private" as const, value: "review" },
    observedAt: new Date(now - 1000),
    expiresAt: new Date(now + 3600000),
  };
  const campaignPolicy = campaignPolicyDefinitionSchema.parse({
    version: 1,
    accountConnectionId: id,
    effectiveAt: new Date(now - 1000),
    expiresAt: new Date(now + 3600000),
    offer: "review",
    capabilityEvidence: "review",
    jurisdiction: "GB",
    provider: "gmail",
    permissionRequirement: "consent",
    haltThresholds: { hardBounces: 1, complaints: 1 },
    variants: [
      { id: "a", version: 1, cta: "May I?" },
      { id: "b", version: 1, cta: "Could I?" },
    ],
    cadenceFamily: "review",
    recipientTimezone: "Europe/London",
    windowStart: "00:00",
    windowEnd: "23:59",
    sendWeekdays: [1, 2, 3, 4, 5, 6, 7],
    capabilityAttestation: attestation,
    providerAttestation: {
      ...attestation,
      provider: "gmail",
      jurisdiction: "GB",
      confirmed: true,
    },
  });
  const campaign = await executeCampaignCommand(
    db,
    {
      type: "create",
      requestId: randomUUID(),
      name: "resume test",
      policy: campaignPolicy,
    },
    founder,
    randomUUID(),
  );
  try {
    await executeCampaignCommand(
      db,
      {
        type: "approve",
        requestId: randomUUID(),
        campaignId: campaign.id,
        policyVersion: 1,
      },
      founder,
      randomUUID(),
    );
    await admin`update growth.outreach_account_controls set state='paused' where connection_id=${id}`;
    await assert.rejects(
      executeCampaignCommand(
        db,
        {
          type: "resume",
          requestId: randomUUID(),
          campaignId: campaign.id,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      ),
      /account_not_active/,
    );
    await admin`update growth.outreach_account_controls set state='active' where connection_id=${id}`;
    await executeCampaignCommand(
      db,
      {
        type: "resume",
        requestId: randomUUID(),
        campaignId: campaign.id,
        policyVersion: 1,
      },
      founder,
      randomUUID(),
    );
    const [running] =
      await admin`select status from growth.campaigns where id=${campaign.id} and version=1`;
    assert.equal(running?.status, "approved");
    await executeCampaignCommand(
      db,
      {
        type: "revise",
        requestId: randomUUID(),
        campaignId: campaign.id,
        policyVersion: 1,
        policy: { ...campaignPolicy, version: 2 },
      },
      founder,
      randomUUID(),
    );
    await executeCampaignCommand(
      db,
      {
        type: "approve",
        requestId: randomUUID(),
        campaignId: campaign.id,
        policyVersion: 2,
      },
      founder,
      randomUUID(),
    );
    await executeCampaignCommand(
      db,
      {
        type: "resume",
        requestId: randomUUID(),
        campaignId: campaign.id,
        policyVersion: 2,
      },
      founder,
      randomUUID(),
    );
    const business = randomUUID(),
      contact = randomUUID(),
      prospect = randomUUID(),
      sequence = randomUUID(),
      message = randomUUID(),
      member = randomUUID(),
      permission = randomUUID(),
      proofRequest = randomUUID(),
      lease = randomUUID(),
      oldSequence = randomUUID(),
      oldMessage = randomUUID(),
      oldMember = randomUUID();
    try {
      await admin`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},'Campaign authority test','limited_company','active','Test','Test','https://example.test','GB')`;
      await admin`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${`${randomUUID()}@example.test`},'https://example.test',now(),'corporate','consent')`;
      await admin`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,${email})`;
      await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${sequence},${prospect},${contact},'active')`;
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,subject_snapshot,html_snapshot,text_snapshot) values (${message},${sequence},${prospect},${contact},'gmail','outbound',0,'sending',${randomUUID()},${lease},now()+interval '5 minutes','queued','Subject','<p>Body</p>','Body')`;
      await admin`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,request_id,status,sequence_id) values (${member},${campaign.id},2,${business},${prospect},${randomUUID()},'active',${sequence})`;
      await admin`insert into growth.source_evidence(prospect_id,source_type,source_url,claim_type,claim_summary,observed_at,verified_at,retention_class,origin,founder_actor_id,request_id,request_hash,contact_id,business_id,contact_version,prospect_version) select ${prospect},'founder_verified','https://example.test',claim,'reviewed',now()-interval '1 minute',now()-interval '1 minute','prospect_research','founder',${founder.actorId},${proofRequest},${"a".repeat(64)},${contact},${business},1,1 from unnest(array['contact_email','business_observation']) claim`;
      await admin`insert into growth.outreach_permissions(id,membership_id,basis,provider,jurisdiction,expires_at,actor_id,evidence,contact_id,proof_request_id,contact_version,prospect_version) values (${permission},${member},'consent','gmail','GB',now()+interval '1 hour',${founder.actorId},${admin.json({ observedAt: new Date(now - 1000).toISOString(), explicitOptIn: true, summary: "reviewed", reference: { kind: "private", value: "permission" } })},${contact},${proofRequest},1,1)`;
      await admin`update growth.campaign_memberships set current_permission_id=${permission} where id=${member}`;
      await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${oldSequence},${prospect},${contact},'completed')`;
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key) values (${oldMessage},${oldSequence},${prospect},${contact},'gmail','outbound',0,'failed',${randomUUID()})`;
      await admin`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,request_id,status,sequence_id) values (${oldMember},${campaign.id},1,${business},${prospect},${randomUUID()},'stopped',${oldSequence})`;
      await admin`insert into growth.outreach_reservations(idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) select gen_random_uuid()::text,${campaign.id},1,${oldMember},${oldMessage},${oldSequence},${id},(now() at time zone 'Europe/London')::date,'rejected',${id},1,'<old@example.test>',1,${"a".repeat(64)},${lease},now()+interval '5 minutes',now() from generate_series(1,25)`;
      assert.deepEqual(
        await reserveOutreachAttempt(db, {
          messageId: message,
          leaseToken: lease,
          attemptKey: randomUUID(),
        }),
        { status: "held", reason: "campaign_limit" },
      );
      await admin`delete from growth.outreach_reservations where email_message_id=${oldMessage}`;
      await admin`delete from growth.campaign_memberships where id=${oldMember}`;
      await admin`delete from growth.email_messages where id=${oldMessage}`;
      await admin`delete from growth.sequence_enrollments where id=${oldSequence}`;
      const manualBusiness = randomUUID(),
        manualContact = randomUUID(),
        manualProspect = randomUUID(),
        manualSequence = randomUUID(),
        manualMessage = randomUUID(),
        manualLease = randomUUID();
      const manualEmail = `${randomUUID()}@example.test`;
      try {
        await admin`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${manualBusiness},'Manual race','limited_company','active','Test','Test','https://example.test','GB')`;
        await admin`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${manualContact},${manualBusiness},${manualEmail},'https://example.test',now(),'corporate','consent')`;
        await admin`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${manualProspect},${manualBusiness},${manualContact},'ready_for_email_review',0,'test','test',0,0,${email})`;
        await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,template_snapshot) values (${manualSequence},${manualProspect},${manualContact},'active',${admin.json({ followUpPolicy: "manual_only", approvedRecipient: manualEmail })})`;
        await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at,outreach_claim_previous_status,subject_snapshot,html_snapshot,text_snapshot) values (${manualMessage},${manualSequence},${manualProspect},${manualContact},'gmail','outbound',0,'sending',${randomUUID()},${manualLease},now()+interval '5 minutes','queued','Manual','<p>Manual</p>','Manual')`;
        await admin`update growth.outreach_account_controls set ramp=25 where connection_id=${id}`;
        await admin`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) select gen_random_uuid()::text,${manualMessage},${manualSequence},${id},(now() at time zone 'Europe/London')::date,'rejected',${id},1,'<seed@example.test>',1,${"a".repeat(64)},${manualLease},now()+interval '5 minutes',now() from generate_series(1,24)`;
        const mixedRace = await Promise.all([
          reserveOutreachAttempt(db, {
            messageId: message,
            leaseToken: lease,
            attemptKey: randomUUID(),
          }),
          reserveOutreachAttempt(db, {
            messageId: manualMessage,
            leaseToken: manualLease,
            attemptKey: randomUUID(),
          }),
        ]);
        assert.equal(
          mixedRace.filter((result) => result.status === "ready").length,
          1,
        );
        assert.ok(
          mixedRace.some(
            (result) =>
              result.status === "held" && result.reason === "account_limit",
          ),
        );
      } finally {
        await admin`update growth.outreach_account_controls set ramp=50 where connection_id=${id}`;
        await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${message},${manualMessage}))`;
        await admin`delete from growth.outreach_reservations where email_message_id in (${message},${manualMessage})`;
        await admin`delete from growth.email_messages where id=${manualMessage}`;
        await admin`delete from growth.sequence_enrollments where id=${manualSequence}`;
        await admin`delete from growth.prospects where id=${manualProspect}`;
        await admin`delete from growth.contacts where id=${manualContact}`;
        await admin`delete from growth.businesses where id=${manualBusiness}`;
      }
      const attempt = await reserveOutreachAttempt(db, {
        messageId: message,
        leaseToken: lease,
        attemptKey: randomUUID(),
      });
      assert.ok(attempt.status === "ready");
      const campaignBegin = {
        reservationId: attempt.value.reservationId,
        leaseToken: lease,
        fence: attempt.value.fence,
        fingerprint: attempt.value.preparation.fingerprint,
      };
      await admin`update growth.campaigns set status='paused' where id=${campaign.id} and version=2`;
      assert.equal(
        (await beginOutreachSubmission(db, campaignBegin)).status,
        "held",
      );
      await admin`update growth.campaigns set status='approved' where id=${campaign.id} and version=2`;
      await admin`update growth.campaign_memberships set status='stopped' where id=${member}`;
      assert.equal(
        (await beginOutreachSubmission(db, campaignBegin)).status,
        "held",
      );
      await admin`update growth.campaign_memberships set status='active' where id=${member}`;
      await admin`update growth.integration_connections set version=version+1 where id=${id}`;
      assert.equal(
        (await beginOutreachSubmission(db, campaignBegin)).status,
        "held",
      );
      await admin`update growth.integration_connections set version=version-1 where id=${id}`;
      await admin`update growth.campaign_memberships set current_permission_id=null where id=${member}`;
      const blocked = await beginOutreachSubmission(db, {
        reservationId: attempt.value.reservationId,
        leaseToken: lease,
        fence: attempt.value.fence,
        fingerprint: attempt.value.preparation.fingerprint,
      });
      assert.equal(blocked.status, "held");
      await admin`update growth.campaign_memberships set current_permission_id=${permission} where id=${member}`;
      await admin`update growth.contacts set version=version+1 where id=${contact}`;
      assert.equal(
        (
          await beginOutreachSubmission(db, {
            reservationId: attempt.value.reservationId,
            leaseToken: lease,
            fence: attempt.value.fence,
            fingerprint: attempt.value.preparation.fingerprint,
          })
        ).status,
        "held",
      );
    } finally {
      await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id in (select id::text from growth.outreach_reservations where email_message_id=${message})`;
      await admin`delete from growth.outreach_reservations where email_message_id in (${message},${oldMessage})`;
      await admin`delete from growth.campaign_memberships where id=${oldMember}`;
      await admin`delete from growth.email_messages where id=${oldMessage}`;
      await admin`delete from growth.sequence_enrollments where id=${oldSequence}`;
      await admin`update growth.campaign_memberships set current_permission_id=null where id=${member}`;
      await admin`delete from growth.outreach_permissions where id=${permission}`;
      await admin`delete from growth.campaign_memberships where id=${member}`;
      await admin`delete from growth.email_messages where id=${message}`;
      await admin`delete from growth.sequence_enrollments where id=${sequence}`;
      await admin.begin(async (tx) => {
        await tx`alter table growth.source_evidence disable trigger protect_founder_source_evidence`;
        await tx`delete from growth.source_evidence where request_id=${proofRequest}`;
        await tx`alter table growth.source_evidence enable trigger protect_founder_source_evidence`;
      });
      await admin`delete from growth.prospects where id=${prospect}`;
      await admin`delete from growth.contacts where id=${contact}`;
      await admin`delete from growth.businesses where id=${business}`;
    }
  } finally {
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaign.id})`;
    await admin`delete from growth.outreach_events where campaign_id=${campaign.id}`;
    await admin`delete from growth.audit_log where entity_type='campaign' and entity_id=${campaign.id}`;
    await admin`delete from growth.campaigns where id=${campaign.id}`;
  }
}
