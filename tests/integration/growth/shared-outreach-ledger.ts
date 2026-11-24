import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { reserveOutreachAttempt } from "../../../lib/growth/campaigns/reservation-repository";

export async function exerciseSharedLedger(
  admin: GrowthDb,
  db: GrowthDb,
  connectionId: string,
  owner: string,
  options: { atLimit?: "global_limit" | "account_limit" } = {},
): Promise<void> {
  const business = randomUUID(),
    contact = randomUUID(),
    prospect = randomUUID(),
    sequence = randomUUID();
  const oldMessage = randomUUID(),
    newMessage = randomUUID(),
    lease = randomUUID();
  const recipient = `${randomUUID()}@example.test`;
  try {
    await admin`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},'Budget fixture','limited_company','active','Test','Test','https://example.test','GB')`;
    await admin`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${recipient},'https://example.test',now(),'corporate','consent')`;
    await admin`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,${owner})`;
    await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,template_snapshot) values (${sequence},${prospect},${contact},'active',${admin.json({ approvedRecipient: recipient, effectiveRecipient: { email: recipient, contactId: contact, contactVersion: 1, prospectVersion: 1 } })})`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,subject_snapshot,html_snapshot,text_snapshot,lease_token,lease_expires_at,outreach_claim_previous_status,outreach_guarded_claim) values (${oldMessage},${sequence},${prospect},${contact},'gmail','outbound',0,'queued',${randomUUID()},'Subject','<p>Body</p>','Body',null,null,null,false), (${newMessage},${sequence},${prospect},${contact},'gmail','outbound',0,'sending',${randomUUID()},'Subject','<p>Body</p>','Body',${lease},now()+interval '5 minutes','queued',true)`;
    {
      await admin`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
      select gen_random_uuid(),gen_random_uuid()::text,${oldMessage},${sequence},${connectionId},(clock_timestamp() at time zone 'Europe/London')::date,${connectionId},1,'<fixture@example.test>',1,repeat('a',64),gen_random_uuid(),now()+interval '5 minutes',n from generate_series(1,25) n`;
      await admin`update growth.outreach_reservations set status='submitting',submitted_at=clock_timestamp() where email_message_id=${oldMessage} and fence=1`;
      await admin`update growth.outreach_reservations set status='uncertain' where email_message_id=${oldMessage} and fence=1`;
    }
    const attempt = {
      messageId: newMessage,
      leaseToken: lease,
      attemptKey: randomUUID(),
    };
    {
      assert.deepEqual(await reserveOutreachAttempt(db, attempt), {
        status: "held",
        reason: options.atLimit ?? "global_limit",
      });
      await admin`delete from growth.outreach_reservations where email_message_id=${oldMessage} and fence=25`;
    }
    const reservation = await reserveOutreachAttempt(db, attempt);
    assert.equal(reservation.status, "ready");
  } finally {
    await admin`delete from growth.audit_log where entity_id in (select id::text from growth.outreach_reservations where email_message_id in (${oldMessage},${newMessage}))`;
    await admin`delete from growth.outreach_reservations where email_message_id in (${oldMessage},${newMessage})`;
    await admin`delete from growth.email_messages where id in (${oldMessage},${newMessage})`;
    await admin`delete from growth.sequence_enrollments where id=${sequence}`;
    await admin`delete from growth.prospects where id=${prospect}`;
    await admin`delete from growth.contacts where id=${contact}`;
    await admin`delete from growth.businesses where id=${business}`;
  }
}
