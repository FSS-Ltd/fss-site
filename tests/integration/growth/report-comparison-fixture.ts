import { createHash, randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { controlledCopyFamilyFingerprint } from "../../../lib/growth/campaigns/controlled-copy";
import { assignCampaignVariant } from "../../../lib/growth/campaigns/variants";
import { campaignMonthAnniversary } from "../../../lib/growth/campaigns/time";

/** Synthetic committed facts; provider access is never used. */
export async function seedComparableReport(admin: GrowthDb) {
  const campaignId = randomUUID(),
    connectionId = randomUUID(),
    jobId = randomUUID(),
    accountId = `test-${randomUUID()}`,
    subject = `subject-${randomUUID()}`;
  const observedAt = new Date("2026-01-31T11:00:00Z"),
    submittedAt = new Date("2026-01-31T10:59:00Z");
  const raw = Buffer.from("synthetic raw message").toString("base64url"),
    hash = createHash("sha256")
      .update(Buffer.from(raw, "base64url"))
      .digest("hex");
  const variants = [
    { id: "a", version: 1, cta: "May I?" },
    { id: "b", version: 1, cta: "Could I?" },
  ];
  const policy = {
    version: 1,
    accountConnectionId: connectionId,
    provider: "gmail",
    jurisdiction: "GB",
    offer: "review",
    permissionRequirement: "consent",
    cadenceFamily: "review",
    variants,
  };
  const family = controlledCopyFamilyFingerprint({
    familyVersion: 1,
    campaignId,
    policyVersion: 1,
    market: "GB",
    jurisdiction: "GB",
    offer: "review",
    permissionRequirement: "consent",
    cadenceFamily: "review",
    provider: "gmail",
  });
  const ids: {
    business: string;
    contact: string;
    prospect: string;
    sequence: string;
    message: string;
    membership: string;
    reservation: string;
    email: string;
    thread: string;
    variant: string;
  }[] = [];
  let anchorId = "";
  await admin.begin(async (tx) => {
    await tx`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${connectionId},'gmail','report-test@example.test','connected',${subject},${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
    await tx`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${accountId},${connectionId},false,'unknown')`;
    await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${campaignId},1,${randomUUID()},'comparable report fixture',${tx.json(policy)},${connectionId})`;
    const totals = { a: 0, b: 0 };
    while (totals.a < 30 || totals.b < 30) {
      const business = randomUUID();
      const variant = assignCampaignVariant({
        businessId: business,
        market: "GB",
        seed: `${campaignId}:1`,
        variantIds: ["a", "b"],
      });
      if (
        (variant === "a" && totals.a === 30) ||
        (variant === "b" && totals.b === 30)
      )
        continue;
      if (variant === "a") totals.a++;
      else totals.b++;
      const contact = randomUUID(),
        prospect = randomUUID(),
        sequence = randomUUID(),
        message = randomUUID(),
        membership = randomUUID(),
        reservation = randomUUID(),
        email = `${randomUUID()}@example.test`,
        thread = `thread-${randomUUID()}`,
        providerId = `message-${randomUUID()}`,
        rfc = `<${randomUUID()}@example.test>`;
      const recipient = {
        email,
        contactId: contact,
        contactVersion: 1,
        prospectVersion: 1,
      };
      const campaign = {
        campaignId,
        policyVersion: 1,
        membershipId: membership,
        businessId: business,
        cadenceFamily: "review",
        market: "GB",
        offer: "review",
        variantId: variant,
        variantVersion: 1,
        copySha256: "a".repeat(64),
        copyFamilyVersion: 1,
        copyFamilySha256: family,
        permissionId: randomUUID(),
        reviewedRecipient: recipient,
        effectiveRecipient: recipient,
        sourceProof: {
          origin: "founder",
          requestId: randomUUID(),
          contactId: contact,
          contactProofId: randomUUID(),
          observationProofId: randomUUID(),
          proofContactVersion: 1,
          proofProspectVersion: 1,
          freshUntil: "2026-02-01T00:00:00Z",
        },
      };
      const snapshot = {
        version: 1,
        kind: "direct_raw",
        raw,
        rawSha256: hash,
        from: "report-test@example.test",
        googleSubject: subject,
        connectionId,
        grantEpoch: 1,
        rfcMessageId: rfc,
        messageId: message,
        sequenceId: sequence,
        membershipId: membership,
        gmailThreadId: null,
        envelope: { to: [email], cc: [], bcc: [] },
        campaign,
      };
      const receipt = {
        basis: "gmail_fss_sent_observed",
        googleSubject: subject,
        observationGrantEpoch: 1,
        providerMessageId: providerId,
        providerThreadId: thread,
        rfcMessageId: rfc,
        rawSha256: hash,
        observedFrom: "2026-01-31T10:59:59.000Z",
        observedUntil: observedAt.toISOString(),
        providerCreatedAt: "2026-01-31T10:58:59.000Z",
        possibleInvocationFrom: submittedAt.toISOString(),
      };
      await tx`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},'Report comparison test','limited_company','active','Test','Test','https://example.test','GB')`;
      await tx`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${email},'https://example.test',now(),'corporate','consent')`;
      await tx`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev')`;
      await tx`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${sequence},${prospect},${contact},'active')`;
      await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,outreach_guarded_claim,controlled_preparation) values (${message},${sequence},${prospect},${contact},'gmail','outbound',0,'queued',${randomUUID()},true,${tx.json({ version: 1, variantId: variant, variantVersion: 1, observationProofId: campaign.sourceProof.observationProofId, permissionId: campaign.permissionId, copySha256: campaign.copySha256, copyFamilyVersion: 1, copyFamilySha256: family })})`;
      await tx`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,request_id,status,sequence_id) values (${membership},${campaignId},1,${business},${prospect},${randomUUID()},'active',${sequence})`;
      await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence) values (${reservation},${randomUUID()},${campaignId},1,${membership},${message},${sequence},${accountId},'2026-01-31',${connectionId},1,${rfc},1,${"a".repeat(64)},${randomUUID()},now()+interval '5 minutes',1)`;
      await tx`update growth.outreach_reservations set status='submitting',submitted_at=${submittedAt},issued_snapshot=${tx.json(snapshot)},issued_snapshot_hash=${hash} where id=${reservation}`;
      await tx`update growth.outreach_reservations r set status='accepted',provider_message_id=${providerId},provider_thread_id=${thread},direct_submission_evidence=jsonb_build_object('version',1,'kind','gmail_api_send_message_v1','reservationId',r.id::text,'accountId',r.account_id,'connectionId',r.connection_id::text,'googleSubject',r.issued_snapshot->>'googleSubject','grantEpoch',r.grant_epoch,'rfcMessageId',r.rfc_message_id,'rawSha256',r.issued_snapshot_hash,'providerMessageId',${providerId}::text,'providerThreadId',${thread}::text) where id=${reservation}`;
      await tx`update growth.outreach_reservations set confirmation_receipt=${tx.json(receipt)},confirmation_observed_at=${observedAt} where id=${reservation}`;
      await tx`update growth.campaign_memberships set first_confirmation_reservation_id=${reservation},confirmed_snapshot=${tx.json(campaign)} where id=${membership}`;
      if (!anchorId) anchorId = reservation;
      ids.push({
        business,
        contact,
        prospect,
        sequence,
        message,
        membership,
        reservation,
        email,
        thread,
        variant,
      });
      if (variant === "a" && totals.a <= 20) {
        const inbound = randomUUID(),
          providerReply = `reply-${randomUUID()}`,
          review = randomUUID();
        await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,provider_message_id,provider_thread_id,received_at) values (${inbound},${sequence},${prospect},${contact},'gmail','inbound',0,'received',${randomUUID()},${providerReply},${thread},'2026-02-01T12:00:00Z')`;
        await tx`insert into growth.email_events(email_message_id,provider,provider_event_id,event_type,occurred_at) values (${inbound},'gmail',${providerReply},'reply','2026-02-01T12:00:00Z')`;
        await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type,occurred_at,request_id,request_hash,actor_id,result_id,review_inbound_message_id,review_reply_kind) values (${review},${campaignId},1,${membership},'record_reply','2026-03-01T12:00:00Z',${review},${"a".repeat(64)},${createHash("sha256").update("j.ntagengwa@faithfulsoftware.dev").digest("hex")},${inbound},${inbound},'positive')`;
      }
    }
    await tx`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state) values (${connectionId},1,${subject},'100','200','2026-01-31T10:58:00Z','2026-02-15T12:00:00Z','2026-02-15T12:01:00Z','2026-02-15T12:02:00Z','complete')`;
    await tx`insert into growth.outreach_jobs(id,campaign_id,policy_version,job_type,due_at,idempotency_key,status,lease_owner,lease_until,lease_revision,anchor_reservation_id,anchor_revision) values (${jobId},${campaignId},1,'monthly_report',${campaignMonthAnniversary(observedAt)},${randomUUID()},'leased','report-worker',now()+interval '1 hour',1,${anchorId},1)`;
  });
  const cleanup = async () => {
    await admin`delete from growth.audit_log where entity_id=${campaignId}`;
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaignId})`;
    await admin`delete from growth.outreach_events where campaign_id=${campaignId}`;
    await admin`delete from growth.experiment_reviews where campaign_id=${campaignId}`;
    await admin`delete from growth.outreach_jobs where campaign_id=${campaignId}`;
    await admin.begin(async (tx) => {
      await tx`alter table growth.campaign_memberships disable trigger protect_campaign_confirmation`;
      await tx`update growth.campaign_memberships set first_confirmation_reservation_id=null,confirmed_snapshot=null where campaign_id=${campaignId}`;
      await tx`alter table growth.campaign_memberships enable trigger protect_campaign_confirmation`;
    });
    await admin`delete from growth.outreach_reservations where campaign_id=${campaignId}`;
    await admin`delete from growth.campaign_memberships where campaign_id=${campaignId}`;
    await admin`delete from growth.email_events where email_message_id in (select id from growth.email_messages where sequence_enrollment_id=any(${ids.map((i) => i.sequence)}::uuid[]))`;
    await admin`delete from growth.email_messages where sequence_enrollment_id=any(${ids.map((i) => i.sequence)}::uuid[])`;
    await admin`delete from growth.sequence_enrollments where id=any(${ids.map((i) => i.sequence)}::uuid[])`;
    await admin`delete from growth.prospects where id=any(${ids.map((i) => i.prospect)}::uuid[])`;
    await admin`delete from growth.contacts where id=any(${ids.map((i) => i.contact)}::uuid[])`;
    await admin`delete from growth.businesses where id=any(${ids.map((i) => i.business)}::uuid[])`;
    await admin`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
    await admin`delete from growth.campaigns where id=${campaignId}`;
    await admin`delete from growth.outreach_provider_usage where account_id=${accountId}`;
    await admin`delete from growth.integration_connections where id=${connectionId}`;
  };
  return { campaignId, connectionId, jobId, anchorId, ids, cleanup };
}
