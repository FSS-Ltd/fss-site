import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { loadReviewMembershipPreparationAuthority } from "../../../lib/growth/campaigns/founder-verification-reader";
import { exerciseResearchPreparation } from "./research-preparation-assertions";
import { exerciseGmailConfirmation } from "./reservation-confirmation-assertions";
import { exerciseCrossVersionConfirmation } from "./reservation-cross-version-assertions";
import { withTransitionClock } from "./reservation-clock";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { campaignPolicyDefinitionSchema } from "../../../lib/growth/campaigns/schemas";
import { assignCampaignVariant } from "../../../lib/growth/campaigns/variants";
import { buildCampaignCopy } from "../../../lib/growth/campaigns/copy";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import { loadControlledPreparation } from "../../../lib/growth/campaigns/controlled-preparation";
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
    await exerciseResearchPreparation(admin, db, {
      campaignId: campaign.id,
      connectionId: id,
      founder,
    });
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
      await admin`update growth.sequence_enrollments set template_snapshot=(select jsonb_build_object('approvedRecipient',normalised_email,'effectiveRecipient',jsonb_build_object('email',normalised_email,'contactId',id,'contactVersion',version,'prospectVersion',1)) from growth.contacts where id=${contact}) where id=${sequence}`;

      await admin`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,request_id,status,sequence_id) values (${member},${campaign.id},2,${business},${prospect},${randomUUID()},'active',${sequence})`;
      await admin`insert into growth.source_evidence(prospect_id,source_type,source_url,claim_type,claim_summary,observed_at,verified_at,retention_class,origin,founder_actor_id,request_id,request_hash,contact_id,business_id,contact_version,prospect_version) select ${prospect},'founder_verified','https://example.test',claim,'reviewed',now()-interval '1 minute',now()-interval '1 minute','prospect_research','founder',${founder.actorId},${proofRequest},${"a".repeat(64)},${contact},${business},1,1 from unnest(array['contact_email','business_observation']) claim`;
      const permissionEvent = randomUUID();
      await executeCampaignCommand(
        db,
        {
          type: "record_permission",
          requestId: permissionEvent,
          membershipId: member,
          evidenceId: permission,
          basis: "consent",
          provider: "gmail",
          jurisdiction: "GB",
          expiresAt: new Date(now + 3600000),
          observedAt: new Date(now - 1000),
          explicitOptIn: true,
          summary: "Recipient opted in.",
          reference: { kind: "private", value: "permission" },
          expectedProspectVersion: 1,
          expectedContactVersion: 1,
          proofRequestId: proofRequest,
        },
        founder,
        randomUUID(),
      );
      await admin`update growth.campaign_memberships set status='review', sequence_id=null where id=${member}`;
      const prepare = (eventId: string) =>
        withGrowthTransaction(db, (tx) =>
          loadReviewMembershipPreparationAuthority(tx, {
            membershipId: member,
            connectionId: id,
            source: { kind: "permission_event", eventId },
          }),
        );
      const preparation = await prepare(permissionEvent);
      assert.equal(preparation?.proof.origin, "founder");
      assert.equal(preparation?.policyApproverId, founder.actorId);
      assert.equal(await prepare(randomUUID()), null);
      await admin`update growth.campaign_memberships set status='active', sequence_id=${sequence} where id=${member}`;
      const unboundAttempt = await reserveOutreachAttempt(db, {
        messageId: message,
        leaseToken: lease,
        attemptKey: randomUUID(),
      });
      assert.equal(unboundAttempt.status, "ready");
      if (unboundAttempt.status !== "ready")
        throw new Error("reservation missing");
      const rejectUnissued = createGmailConfirmation(db, async () => {
        throw new Error("provider must not be called");
      });
      assert.deepEqual(
        await rejectUnissued(unboundAttempt.value.reservationId),
        { status: "held", reason: "issued_attempt_unknown" },
      );
      assert.deepEqual(
        await beginOutreachSubmission(db, {
          reservationId: unboundAttempt.value.reservationId,
          leaseToken: lease,
          fence: unboundAttempt.value.fence,
          fingerprint: unboundAttempt.value.preparation.fingerprint,
        }),
        { status: "held", reason: "controlled_variant_unproven" },
      );
      await admin`update growth.outreach_reservations set status='submitting',submitted_at=now() where id=${unboundAttempt.value.reservationId}`;
      await admin`update growth.outreach_reservations set status='accepted',provider_message_id='acceptance-only',provider_thread_id='acceptance-thread' where id=${unboundAttempt.value.reservationId}`;
      assert.deepEqual(
        await rejectUnissued(unboundAttempt.value.reservationId),
        { status: "held", reason: "issued_attempt_unknown" },
      );
      await admin`delete from growth.audit_log where entity_id=${unboundAttempt.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${unboundAttempt.value.reservationId}`;
      await admin`update growth.email_messages set rfc_message_id=null where id=${message}`;
      const [copyFacts] = await admin<
        { email: string; observationId: string }[]
      >`
        select ct.normalised_email as email,e.id as "observationId"
        from growth.contacts ct join growth.source_evidence e on e.contact_id=ct.id
        where ct.id=${contact} and e.request_id=${proofRequest} and e.claim_type='business_observation'`;
      assert.ok(copyFacts);
      const variantId = assignCampaignVariant({
        businessId: business,
        market: "GB",
        seed: `${campaign.id}:2`,
        variantIds: ["a", "b"],
      });
      const variant = campaignPolicy.variants.find(
        (item) => item.id === variantId,
      );
      assert.ok(variant);
      const copy = buildCampaignCopy({
        businessName: "Campaign authority test",
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
      const recipient = {
        email: copyFacts.email,
        contactId: contact,
        contactVersion: 1,
        prospectVersion: 1,
      };
      await admin`update growth.sequence_enrollments set template_snapshot=${admin.json({ reviewedRecipient: recipient, effectiveRecipient: recipient })} where id=${sequence}`;
      await admin`update growth.email_messages set subject_snapshot=${copy.subject},html_snapshot=${copy.html},text_snapshot=${copy.text},controlled_preparation=${admin.json({ version: 1, variantId, variantVersion: variant.version, observationProofId: copyFacts.observationId, permissionId: permission, copySha256 })} where id=${message}`;
      await admin`update growth.email_messages set text_snapshot='changed before issuance' where id=${message}`;
      const changedAttempt = await reserveOutreachAttempt(db, {
        messageId: message,
        leaseToken: lease,
        attemptKey: randomUUID(),
      });
      assert.equal(changedAttempt.status, "ready");
      if (changedAttempt.status !== "ready")
        throw new Error("reservation missing");
      assert.deepEqual(
        await beginOutreachSubmission(db, {
          reservationId: changedAttempt.value.reservationId,
          leaseToken: lease,
          fence: changedAttempt.value.fence,
          fingerprint: changedAttempt.value.preparation.fingerprint,
        }),
        { status: "held", reason: "controlled_variant_unproven" },
      );
      await admin`delete from growth.audit_log where entity_id=${changedAttempt.value.reservationId}`;
      await admin`delete from growth.outreach_reservations where id=${changedAttempt.value.reservationId}`;
      await admin`update growth.email_messages set text_snapshot=${copy.text},rfc_message_id=null where id=${message}`;
      const followupId = randomUUID();
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,subject_snapshot,html_snapshot,text_snapshot,controlled_preparation)
        select ${followupId},sequence_enrollment_id,prospect_id,contact_id,channel,direction,1,'draft',${randomUUID()},subject_snapshot,html_snapshot,text_snapshot,controlled_preparation from growth.email_messages where id=${message}`;
      try {
        const preparation = {
          messageId: message,
          sequenceId: sequence,
          recipient: copyFacts.email,
          subject: copy.subject,
          html: copy.html,
          text: copy.text,
          gmailThreadId: null,
          references: [],
          fingerprint: "a".repeat(64),
        };
        const check = (messageId: string) =>
          withGrowthTransaction(db, (tx) =>
            loadControlledPreparation(tx, {
              membershipId: member,
              connectionId: id,
              preparation: { ...preparation, messageId },
            }),
          );
        assert.ok(await check(message));
        assert.equal(await check(followupId), null);
      } finally {
        await admin`delete from growth.email_messages where id=${followupId}`;
      }
      await admin`delete from growth.outreach_outbox where event_id=${permissionEvent}`;
      await admin`delete from growth.outreach_events where id=${permissionEvent}`;

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
        await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,template_snapshot) values (${manualSequence},${manualProspect},${manualContact},'active',${admin.json({ followUpPolicy: "manual_only", approvedRecipient: manualEmail, effectiveRecipient: { email: manualEmail, contactId: manualContact, contactVersion: 1, prospectVersion: 1 } })})`;
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
        await admin`update growth.email_messages set rfc_message_id=null where id=${message}`;
        await admin`delete from growth.email_messages where id=${manualMessage}`;
        await admin`delete from growth.sequence_enrollments where id=${manualSequence}`;
        await admin`delete from growth.prospects where id=${manualProspect}`;
        await admin`delete from growth.contacts where id=${manualContact}`;
        await admin`delete from growth.businesses where id=${manualBusiness}`;
      }
      const [sample] = await admin<
        { now: Date }[]
      >`select clock_timestamp() as now`;
      assert.ok(sample);
      const t0 = sample.now;
      const t1 = new Date(t0.getTime() + 1000);
      for (const bound of [
        "policy",
        "capability",
        "provider",
        "permission",
      ] as const) {
        try {
          if (bound === "permission") {
            await admin`update growth.outreach_permissions set expires_at=${t1} where id=${permission}`;
          } else {
            const changed = structuredClone(campaignPolicy);
            changed.version = 2;
            if (bound === "policy") changed.expiresAt = t1;
            if (bound === "capability")
              changed.capabilityAttestation.expiresAt = t1;
            if (bound === "provider")
              changed.providerAttestation.expiresAt = t1;
            await admin.begin(async (tx) => {
              await tx`alter table growth.campaigns disable trigger campaign_policy_immutable`;
              await tx`update growth.campaigns set policy=${tx.json(JSON.parse(JSON.stringify(changed)))} where id=${campaign.id} and version=2`;
              await tx`alter table growth.campaigns enable trigger campaign_policy_immutable`;
            });
          }
          assert.deepEqual(
            await reserveOutreachAttempt(withTransitionClock(db, t0, t1), {
              messageId: message,
              leaseToken: lease,
              attemptKey: randomUUID(),
            }),
            { status: "held", reason: "authority_expired" },
            bound,
          );
          const [writes] = await admin<
            { count: number; rfc: string | null }[]
          >`select (select count(*)::int from growth.outreach_reservations where email_message_id=${message}) as count,rfc_message_id as rfc from growth.email_messages where id=${message}`;
          assert.equal(writes?.count, 0, bound);
          assert.equal(writes?.rfc, null, bound);
        } finally {
          await admin`update growth.outreach_permissions set expires_at=${new Date(now + 3600000)} where id=${permission}`;
          await admin.begin(async (tx) => {
            await tx`alter table growth.campaigns disable trigger campaign_policy_immutable`;
            await tx`update growth.campaigns set policy=${tx.json(JSON.parse(JSON.stringify({ ...campaignPolicy, version: 2 })))} where id=${campaign.id} and version=2`;
            await tx`alter table growth.campaigns enable trigger campaign_policy_immutable`;
          });
        }
      }
      for (const [claim, field] of [
        ["contact_email", "observed"],
        ["contact_email", "verified"],
        ["business_observation", "observed"],
        ["business_observation", "verified"],
      ] as const) {
        const oldest = new Date(t1.getTime() - 30 * 86400000);
        try {
          await admin.begin(async (tx) => {
            await tx`alter table growth.source_evidence disable trigger protect_founder_source_evidence`;
            if (field === "observed")
              await tx`update growth.source_evidence set observed_at=${oldest} where request_id=${proofRequest} and claim_type=${claim}`;
            else
              await tx`update growth.source_evidence set verified_at=${oldest} where request_id=${proofRequest} and claim_type=${claim}`;
            await tx`alter table growth.source_evidence enable trigger protect_founder_source_evidence`;
          });
          assert.deepEqual(
            await reserveOutreachAttempt(
              withTransitionClock(db, t0, new Date(t1.getTime() + 1)),
              {
                messageId: message,
                leaseToken: lease,
                attemptKey: randomUUID(),
              },
            ),
            { status: "held", reason: "authority_expired" },
            `${claim} ${field}`,
          );
          const reserve = await reserveOutreachAttempt(
            withTransitionClock(db, t0, t1),
            { messageId: message, leaseToken: lease, attemptKey: randomUUID() },
          );
          assert.ok(reserve.status === "ready", `${claim} ${field}`);
          const begin = await beginOutreachSubmission(
            withTransitionClock(db, t0, t1),
            {
              reservationId: reserve.value.reservationId,
              leaseToken: lease,
              fence: reserve.value.fence,
              fingerprint: reserve.value.preparation.fingerprint,
            },
          );
          assert.ok(begin.status === "ready", `${claim} ${field}`);
          assert.equal(
            begin.value.preparation.fingerprint,
            reserve.value.preparation.fingerprint,
          );
          await admin`delete from growth.audit_log where entity_type='outreach_reservation' and entity_id=${reserve.value.reservationId}`;
          await admin`delete from growth.outreach_reservations where id=${reserve.value.reservationId}`;
          await admin`update growth.email_messages set rfc_message_id=null where id=${message}`;
        } finally {
          await admin.begin(async (tx) => {
            await tx`alter table growth.source_evidence disable trigger protect_founder_source_evidence`;
            await tx`update growth.source_evidence set observed_at=${new Date(now - 60000)},verified_at=${new Date(now - 60000)} where request_id=${proofRequest}`;
            await tx`alter table growth.source_evidence enable trigger protect_founder_source_evidence`;
          });
        }
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
      await exerciseGmailConfirmation(admin, db, {
        campaign,
        campaignBegin,
        contact,
        message,
        member,
        sequence,
        prospect,
        id,
        email,
        now,
        copyFacts,
        copy,
        copySha256,
      });
    } finally {
      await admin`delete from growth.outreach_jobs where campaign_id=${campaign.id}`;
      await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaign.id} and event_type='gmail_sent_observed')`;
      await admin`delete from growth.outreach_events where campaign_id=${campaign.id} and event_type='gmail_sent_observed'`;
      await admin.begin(async (tx) => {
        await tx`alter table growth.campaign_memberships disable trigger protect_campaign_confirmation`;
        await tx`update growth.campaign_memberships set first_confirmation_reservation_id=null,confirmed_snapshot=null where id=${member}`;
        await tx`alter table growth.campaign_memberships enable trigger protect_campaign_confirmation`;
      });
      await admin`delete from growth.email_messages where sequence_enrollment_id=${sequence} and step_number in (1,2)`;
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
  await exerciseCrossVersionConfirmation(admin, db, {
    connectionId: id,
    ownerEmail: email,
    now,
    founder,
    policy: campaignPolicy,
  });
}
