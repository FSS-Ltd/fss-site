import { createHash, randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { campaignMonthAnniversary } from "../../../lib/growth/campaigns/time";

// All identifiers and observations here are synthetic. The database transitions
// follow the same issued -> direct submission -> confirmed receipt guards.
export async function seedMonthlyReport(admin: GrowthDb) {
  const campaignId = randomUUID(),
    businessId = randomUUID(),
    contactId = randomUUID(),
    prospectId = randomUUID();
  const sequenceId = randomUUID(),
    messageId = randomUUID(),
    membershipId = randomUUID(),
    connectionId = randomUUID();
  const reservationId = randomUUID(),
    jobId = randomUUID(),
    permissionId = randomUUID();
  const accountId = `synthetic-${randomUUID()}`,
    subject = `subject-${randomUUID()}`,
    providerId = `message-${randomUUID()}`,
    threadId = `thread-${randomUUID()}`;
  const email = `${randomUUID()}@example.test`,
    rfc = `<${randomUUID()}@example.test>`;
  const observedAt = new Date("2026-01-31T11:00:00Z"),
    submittedAt = new Date("2026-01-31T10:59:00Z");
  const raw = Buffer.from("synthetic message").toString("base64url");
  const hash = createHash("sha256")
    .update(Buffer.from(raw, "base64url"))
    .digest("hex");
  const recipient = { email, contactId, contactVersion: 1, prospectVersion: 1 };
  const campaign = {
    campaignId,
    membershipId,
    businessId,
    policyVersion: 1,
    cadenceFamily: "review",
    market: "GB",
    offer: "review",
    variantId: "a",
    variantVersion: 1,
    copySha256: "a".repeat(64),
    permissionId,
    reviewedRecipient: recipient,
    effectiveRecipient: recipient,
    sourceProof: {
      origin: "founder",
      requestId: randomUUID(),
      contactId,
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
    from: "sender@example.test",
    googleSubject: subject,
    connectionId,
    grantEpoch: 1,
    rfcMessageId: rfc,
    messageId,
    sequenceId,
    membershipId,
    gmailThreadId: null,
    envelope: { to: [email], cc: [], bcc: [] },
    campaign,
  };
  const receipt = {
    basis: "gmail_fss_sent_observed",
    googleSubject: subject,
    observationGrantEpoch: 1,
    providerMessageId: providerId,
    providerThreadId: threadId,
    rfcMessageId: rfc,
    rawSha256: hash,
    observedFrom: "2026-01-31T10:59:59.000Z",
    observedUntil: observedAt.toISOString(),
    providerCreatedAt: "2026-01-31T10:58:59.000Z",
    possibleInvocationFrom: submittedAt.toISOString(),
  };
  await admin.begin(async (tx) => {
    await tx`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${connectionId},'gmail','sender@example.test','connected',${subject},${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
    await tx`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${accountId},${connectionId},false,'unknown')`;
    await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${campaignId},1,${randomUUID()},'synthetic report',${admin.json({ version: 1, accountConnectionId: connectionId, provider: "gmail", offer: "review", variants: [{ id: "a", version: 1, cta: "Interested?" }] })},${connectionId})`;
    await tx`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${businessId},'Synthetic report','limited_company','active','Test','Test','https://example.test','GB')`;
    await tx`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contactId},${businessId},${email},'https://example.test',now(),'corporate','consent')`;
    await tx`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospectId},${businessId},${contactId},'ready_for_email_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev')`;
    await tx`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${sequenceId},${prospectId},${contactId},'active')`;
    await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,outreach_guarded_claim) values (${messageId},${sequenceId},${prospectId},${contactId},'gmail','outbound',0,'queued',${randomUUID()},true)`;
    await tx`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,request_id,status,sequence_id) values (${membershipId},${campaignId},1,${businessId},${prospectId},${randomUUID()},'active',${sequenceId})`;
    await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence) values (${reservationId},${randomUUID()},${campaignId},1,${membershipId},${messageId},${sequenceId},${accountId},'2026-01-31',${connectionId},1,${rfc},1,${"a".repeat(64)},${randomUUID()},now()+interval '5 minutes',1)`;
    await tx`update growth.outreach_reservations set status='submitting',submitted_at=${submittedAt},issued_snapshot=${admin.json(snapshot)},issued_snapshot_hash=${hash} where id=${reservationId}`;
    await tx`update growth.outreach_reservations r set status='accepted',provider_message_id=${providerId},provider_thread_id=${threadId},direct_submission_evidence=jsonb_build_object('version',1,'kind','gmail_api_send_message_v1','reservationId',r.id::text,'accountId',r.account_id,'connectionId',r.connection_id::text,'googleSubject',r.issued_snapshot->>'googleSubject','grantEpoch',r.grant_epoch,'rfcMessageId',r.rfc_message_id,'rawSha256',r.issued_snapshot_hash,'providerMessageId',${providerId}::text,'providerThreadId',${threadId}::text) where r.id=${reservationId} and r.status='submitting'`;
    await tx`update growth.outreach_reservations set confirmation_receipt=${admin.json(receipt)},confirmation_observed_at=${observedAt} where id=${reservationId}`;
    await tx`update growth.campaign_memberships set first_confirmation_reservation_id=${reservationId},confirmed_snapshot=${admin.json(campaign)} where id=${membershipId}`;
    await tx`insert into growth.outreach_jobs(id,campaign_id,policy_version,job_type,due_at,idempotency_key,status,lease_owner,lease_until,lease_revision,anchor_reservation_id,anchor_revision) values (${jobId},${campaignId},1,'monthly_report',${campaignMonthAnniversary(observedAt)},${randomUUID()},'leased','report-worker',now()+interval '1 hour',1,${reservationId},1)`;
  });
  const createEarlierReceipt = async () => {
    const earlierId = randomUUID();
    const earlierAt = new Date(observedAt.getTime() - 60_000);
    const earlierProvider = `earlier-${randomUUID()}`;
    await admin`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
      select ${earlierId},${randomUUID()},campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence+1 from growth.outreach_reservations where id=${reservationId}`;
    await admin`update growth.outreach_reservations set status='submitting',submitted_at=${earlierAt},issued_snapshot=(select issued_snapshot from growth.outreach_reservations where id=${reservationId}),issued_snapshot_hash=${hash} where id=${earlierId}`;
    await admin`update growth.outreach_reservations r set status='accepted',provider_message_id=${earlierProvider},provider_thread_id=${threadId},direct_submission_evidence=jsonb_build_object('version',1,'kind','gmail_api_send_message_v1','reservationId',r.id::text,'accountId',r.account_id,'connectionId',r.connection_id::text,'googleSubject',r.issued_snapshot->>'googleSubject','grantEpoch',r.grant_epoch,'rfcMessageId',r.rfc_message_id,'rawSha256',r.issued_snapshot_hash,'providerMessageId',${earlierProvider}::text,'providerThreadId',${threadId}::text) where id=${earlierId}`;
    const earlierReceipt = {
      ...receipt,
      providerMessageId: earlierProvider,
      observedFrom: new Date(earlierAt.getTime() - 1000).toISOString(),
      observedUntil: earlierAt.toISOString(),
      providerCreatedAt: new Date(earlierAt.getTime() - 2000).toISOString(),
      possibleInvocationFrom: null,
    };
    await admin`update growth.outreach_reservations set confirmation_receipt=${admin.json(earlierReceipt)},confirmation_observed_at=${earlierAt} where id=${earlierId}`;
    return { id: earlierId, observedAt: earlierAt };
  };
  const insertReviewedReply = async (receivedAt: Date, reviewedAt: Date) => {
    const replyId = randomUUID(),
      eventId = randomUUID(),
      providerMessage = `reply-${randomUUID()}`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,provider_message_id,provider_thread_id,received_at)
      values (${replyId},${sequenceId},${prospectId},${contactId},'gmail','inbound',0,'received',${randomUUID()},${providerMessage},${threadId},${receivedAt})`;
    await admin`insert into growth.email_events(email_message_id,provider,provider_event_id,event_type,occurred_at) values (${replyId},'gmail',${providerMessage},'reply',${receivedAt})`;
    await admin`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type,occurred_at,request_id,request_hash,actor_id,result_id,review_inbound_message_id,review_reply_kind)
      values (${eventId},${campaignId},1,${membershipId},'record_reply',${reviewedAt},${eventId},${"a".repeat(64)},${"b".repeat(64)},${replyId},${replyId},'positive')`;
    return replyId;
  };
  const cleanup = async () => {
    await admin`delete from growth.audit_log where entity_id=${campaignId}`;
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaignId})`;
    await admin`delete from growth.outreach_events where campaign_id=${campaignId}`;
    await admin`delete from growth.experiment_reviews where campaign_id=${campaignId}`;
    await admin`delete from growth.outreach_jobs where campaign_id=${campaignId}`;
    // The fixture belongs exclusively to this test and these cyclic FKs require
    // a deferred transaction when removing the synthetic membership and receipt.
    await admin.begin(async (tx) => {
      await tx`alter table growth.campaign_memberships disable trigger protect_campaign_confirmation`;
      await tx`update growth.campaign_memberships set first_confirmation_reservation_id=null,confirmed_snapshot=null where id=${membershipId}`;
      await tx`alter table growth.campaign_memberships enable trigger protect_campaign_confirmation`;
    });
    await admin`delete from growth.outreach_reservations where membership_id=${membershipId}`;
    await admin`delete from growth.campaign_memberships where id=${membershipId}`;
    await admin`delete from growth.email_events where email_message_id in (select id from growth.email_messages where sequence_enrollment_id=${sequenceId})`;
    await admin`delete from growth.email_messages where sequence_enrollment_id=${sequenceId}`;
    await admin`delete from growth.sequence_enrollments where id=${sequenceId}`;
    await admin`delete from growth.prospects where id=${prospectId}`;
    await admin`delete from growth.contacts where id=${contactId}`;
    await admin`delete from growth.businesses where id=${businessId}`;
    await admin`delete from growth.campaigns where id=${campaignId}`;
    await admin`delete from growth.outreach_provider_usage where account_id=${accountId}`;
    await admin`delete from growth.integration_connections where id=${connectionId}`;
  };
  return {
    campaignId,
    membershipId,
    reservationId,
    jobId,
    observedAt,
    cleanup,
    createEarlierReceipt,
    insertReviewedReply,
  };
}
