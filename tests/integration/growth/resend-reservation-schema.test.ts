import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const connection = process.env.DIRECT_DATABASE_URL;
test(
  "Resend reservation identity, body and terminal evidence are immutable",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const db = postgres(connection, { max: 1 });
    const rollback = new Error("rollback synthetic fixture");
    try {
      await assert.rejects(
        db.begin(async (tx) => {
          const account = randomUUID(),
            campaign = randomUUID(),
            business = randomUUID(),
            contact = randomUUID(),
            prospect = randomUUID(),
            sequence = randomUUID(),
            message = randomUUID(),
            member = randomUUID(),
            reservation = randomUUID(),
            generation = randomUUID(),
            lease = randomUUID(),
            attempt = randomUUID();
          const sender = `${randomUUID()}@example.test`;
          const recipient = `${randomUUID()}@example.test`;
          await tx`insert into growth.integration_connections(id,provider,subject_email) values (${account},'resend',${sender})`;
          const review = randomUUID();
          const binding = {
            team: `fixture-${randomUUID()}`,
            environment: "production",
            sender,
            domain: "example.test",
            replyTo: sender,
            sendGeneration: generation,
            usageGeneration: randomUUID(),
          };
          await tx`insert into growth.outreach_account_controls(connection_id,provider,state,verified_subject,verified_grant_epoch,verified_scopes,resend_team,resend_environment,resend_binding) values (${account},'resend','active',null,null,null,${binding.team},${binding.environment},${tx.json(binding)})`;
          await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${review},${account},${randomUUID()},repeat('a',64),${createHash("sha256").update("j.ntagengwa@faithfulsoftware.dev").digest("hex")},'resend_configure',${tx.json({ binding })},2)`;
          await tx`update growth.outreach_account_controls set resend_binding_review_id=${review} where connection_id=${account}`;
          await tx`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${account},${account},false,'unknown')`;
          await tx`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},'Schema fixture','limited_company','active','Test','Test','https://example.test','GB')`;
          await tx`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${recipient},'https://example.test',now(),'corporate','consent')`;
          await tx`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev')`;
          await tx`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${sequence},${prospect},${contact},'active')`;
          await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,lease_token,lease_expires_at) values (${message},${sequence},${prospect},${contact},'resend','outbound',0,'sending',${randomUUID()},${lease},now()+interval '5 minutes')`;
          await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${campaign},1,${randomUUID()},'schema',${tx.json({ accountConnectionId: account, provider: "resend" })},${account})`;
          await tx`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,sequence_id,request_id,status) values (${member},${campaign},1,${business},${prospect},${sequence},${randomUUID()},'active')`;
          await tx`set local role growth_app`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
          values (${randomUUID()},${randomUUID()},${campaign},1,${member},${message},${sequence},${account},current_date,${account},1,'<fabricated@example.test>',1,repeat('a',64),${lease},now()+interval '5 minutes',1)`;
            }),
          );
          await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,outreach_provider,resend_send_generation,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
        values (${reservation},${attempt},${campaign},1,${member},${message},${sequence},${account},current_date,${account},'resend',${generation},1,repeat('a',64),${lease},now()+interval '5 minutes',1)`;
          const body = JSON.stringify({
            from: sender,
            to: [recipient],
            reply_to: sender,
            subject: "Subject",
            html: "<p>Body</p>",
            text: "Body",
          });
          const bodySha256 = createHash("sha256").update(body).digest("hex");
          const snapshot = {
            version: 1,
            kind: "resend_json",
            rawBody: body,
            bodySha256,
            accountId: account,
            connectionId: account,
            sendGeneration: generation,
            idempotencyKey: attempt,
            messageId: message,
            sequenceId: sequence,
            membershipId: member,
            from: sender,
            replyTo: sender,
            recipient,
            campaign: {
              campaignId: campaign,
              policyVersion: 1,
              membershipId: member,
            },
          };
          const wrongSender = `other-${sender}`;
          const wrongBody = JSON.stringify({
            from: wrongSender,
            to: [recipient],
            reply_to: sender,
            subject: "Subject",
            html: "<p>Body</p>",
            text: "Body",
          });
          const wrongHash = createHash("sha256")
            .update(wrongBody)
            .digest("hex");
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sp.json({ ...snapshot, from: wrongSender, rawBody: wrongBody, bodySha256: wrongHash })},issued_snapshot_hash=${wrongHash} where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sp.json({ ...snapshot, rawBody: body + " " })},issued_snapshot_hash=${bodySha256} where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sp.json({ ...snapshot, campaign: { ...snapshot.campaign, apiKey: "not-allowed" } })},issued_snapshot_hash=${bodySha256} where id=${reservation}`;
            }),
          );
          const emptySubject = JSON.stringify({
            from: sender,
            to: [recipient],
            reply_to: sender,
            subject: "",
            html: "<p>Body</p>",
            text: "Body",
          });
          const emptySubjectHash = createHash("sha256")
            .update(emptySubject)
            .digest("hex");
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sp.json({ ...snapshot, rawBody: emptySubject, bodySha256: emptySubjectHash })},issued_snapshot_hash=${emptySubjectHash} where id=${reservation}`;
            }),
          );
          const familySnapshot = {
            ...snapshot,
            campaign: {
              ...snapshot.campaign,
              copyFamilyVersion: 1,
              copyFamilySha256: "c".repeat(64),
            },
          };
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sp.json({ ...snapshot, campaign: { ...snapshot.campaign, copyFamilyVersion: 1 } })},issued_snapshot_hash=${bodySha256} where id=${reservation}`;
            }),
          );
          await tx`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${tx.json(familySnapshot)},issued_snapshot_hash=${bodySha256} where id=${reservation}`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set resend_send_generation=${randomUUID()} where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='accepted',provider_message_id='provider-id',provider_thread_id='fake-thread' where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='accepted',provider_message_id='provider-id' where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='rejected' where id=${reservation}`;
            }),
          );
          const proof = {
            version: 1,
            kind: "resend_api_send_email_v1",
            reservationId: reservation,
            accountId: account,
            connectionId: account,
            sendGeneration: generation,
            idempotencyKey: attempt,
            bodySha256,
            providerMessageId: "provider-id",
          };
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='accepted',provider_message_id='bad id',direct_submission_evidence=${sp.json({ ...proof, providerMessageId: "bad id" })} where id=${reservation}`;
            }),
          );
          await tx`update growth.outreach_reservations set status='accepted',provider_message_id='provider-id',direct_submission_evidence=${tx.json(proof)} where id=${reservation}`;
          const [row] =
            await tx`select grant_epoch,rfc_message_id,provider_thread_id,actual_sent_at from growth.outreach_reservations where id=${reservation}`;
          assert.deepEqual(
            [
              row?.grant_epoch,
              row?.rfc_message_id,
              row?.provider_thread_id,
              row?.actual_sent_at,
            ],
            [null, null, null, null],
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set direct_submission_evidence=null where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set actual_sent_at=now() where id=${reservation}`;
            }),
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set confirmation_receipt='{}'::jsonb,confirmation_observed_at=now() where id=${reservation}`;
            }),
          );
          const second = randomUUID(),
            secondAttempt = randomUUID();
          await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,outreach_provider,resend_send_generation,recipient_count,authority_fingerprint,lease_token,lease_until,fence) values (${second},${secondAttempt},${campaign},1,${member},${message},${sequence},${account},current_date,${account},'resend',${generation},1,repeat('a',64),${randomUUID()},now()+interval '5 minutes',2)`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now() where id=${second}`;
            }),
          );
          await tx`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${tx.json({ ...snapshot, idempotencyKey: secondAttempt })},issued_snapshot_hash=${bodySha256} where id=${second}`;
          const noInvocation = {
            version: 1,
            kind: "resend_send_not_invoked_v1",
            reservationId: second,
            reason: "guard_or_input_rejected",
          };
          await tx`update growth.outreach_reservations set status='rejected',direct_noninvocation_evidence=${tx.json(noInvocation)} where id=${second}`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set direct_noninvocation_evidence=null where id=${second}`;
            }),
          );
          const third = randomUUID(),
            thirdAttempt = randomUUID();
          await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,outreach_provider,resend_send_generation,recipient_count,authority_fingerprint,lease_token,lease_until,fence) values (${third},${thirdAttempt},${campaign},1,${member},${message},${sequence},${account},current_date,${account},'resend',${generation},1,repeat('a',64),${randomUUID()},now()+interval '5 minutes',3)`;
          await tx`update growth.outreach_account_controls set resend_binding=${tx.json({ ...binding, sendGeneration: randomUUID() })} where connection_id=${account}`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sp.json({ ...snapshot, idempotencyKey: thirdAttempt })},issued_snapshot_hash=${bodySha256} where id=${third}`;
            }),
          );
          const [afterRotation] =
            await tx`select status,direct_submission_evidence from growth.outreach_reservations where id=${reservation}`;
          assert.equal(afterRotation?.status, "accepted");
          assert.deepEqual(afterRotation?.direct_submission_evidence, proof);
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await db.end();
    }
  },
);
