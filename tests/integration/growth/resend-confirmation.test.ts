import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { Webhook } from "svix";
import { createResendConfirmation } from "../../../lib/growth/campaigns/resend-confirmation";

const url = process.env.DIRECT_DATABASE_URL;
for (const scenario of [
  "active",
  "paused",
  "stopped",
  "prior_reply",
  "revoked",
  "unsupported_snapshot",
] as const) {
  test(
    `signed Resend delivery preserves lifecycle for ${scenario}`,
    { skip: !url },
    async () => {
      if (!url) return;
      const target = new URL(url);
      if (
        !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
        target.pathname !== "/fss_growth_test"
      )
        throw new Error("synthetic local database required");
      const admin = postgres(url, { max: 1 }),
        db = postgres(url, {
          max: 2,
          connection: { options: "-c role=growth_app" },
        });
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
        attempt = randomUUID(),
        review = randomUUID();
      const webhookGeneration = randomUUID(),
        sender = `outreach-${randomUUID()}@example.test`,
        recipient = `owner-${randomUUID()}@example.test`,
        providerId = `provider-${randomUUID()}`;
      const binding = {
        team: `team-${randomUUID()}`,
        environment: "production" as const,
        sender,
        domain: "example.test",
        replyTo: sender,
        sendGeneration: generation,
        usageGeneration: randomUUID(),
        webhookGeneration,
      };
      const secret = Buffer.from("synthetic-resend-test-secret-12345").toString(
        "base64",
      );
      const body = JSON.stringify({
          from: sender,
          to: [recipient],
          reply_to: sender,
          subject: "Subject",
          html: "<p>Body</p>",
          text: "Body",
        }),
        bodySha256 = createHash("sha256").update(body).digest("hex");
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
          businessId: business,
          cadenceFamily: "review",
          market: "GB",
          offer: "review",
          variantId: "a",
          variantVersion: 1,
          copySha256: "a".repeat(64),
          ...(scenario === "unsupported_snapshot"
            ? {}
            : { copyFamilyVersion: 1, copyFamilySha256: "b".repeat(64) }),
          permissionId: randomUUID(),
          reviewedRecipient: {
            email: recipient,
            contactId: contact,
            contactVersion: 1,
            prospectVersion: 1,
          },
          effectiveRecipient: {
            email: recipient,
            contactId: contact,
            contactVersion: 1,
            prospectVersion: 1,
          },
          sourceProof: {
            origin: "founder",
            requestId: randomUUID(),
            contactId: contact,
            contactProofId: randomUUID(),
            observationProofId: randomUUID(),
            proofContactVersion: 1,
            proofProspectVersion: 1,
            freshUntil: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      };
      const submittedAt = new Date(Date.now() - 60_000);
      try {
        await admin.begin(async (tx) => {
          await tx`insert into growth.integration_connections(id,provider,subject_email) values (${account},'resend',${sender})`;
          await tx`insert into growth.outreach_account_controls(connection_id,provider,state,verified_subject,verified_grant_epoch,verified_scopes,resend_team,resend_environment,resend_binding) values (${account},'resend','active',null,null,null,${binding.team},${binding.environment},${tx.json(binding)})`;
          await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${review},${account},${randomUUID()},repeat('a',64),${createHash("sha256").update("j.ntagengwa@faithfulsoftware.dev").digest("hex")},'resend_configure',${tx.json({ binding })},2)`;
          await tx`update growth.outreach_account_controls set resend_binding_review_id=${review} where connection_id=${account}`;
          await tx`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${account},${account},false,'unknown')`;
          await tx`insert into growth.businesses(id,legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values (${business},'Resend receipt test','limited_company','active','Test','Test','https://example.test','GB')`;
          await tx`insert into growth.contacts(id,business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${contact},${business},${recipient},'https://example.test',now(),'corporate','consent')`;
          await tx`insert into growth.prospects(id,business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${prospect},${business},${contact},'ready_for_email_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev')`;
          await tx`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status) values (${sequence},${prospect},${contact},'active')`;
          await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key) values (${message},${sequence},${prospect},${contact},'resend','outbound',0,'queued',${randomUUID()})`;
          await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${campaign},1,${randomUUID()},'receipt test',${tx.json({ accountConnectionId: account, provider: "resend" })},${account})`;
          await tx`insert into growth.campaign_memberships(id,campaign_id,policy_version,business_id,prospect_id,sequence_id,request_id,status) values (${member},${campaign},1,${business},${prospect},${sequence},${randomUUID()},'active')`;
          await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,outreach_provider,resend_send_generation,recipient_count,authority_fingerprint,lease_token,lease_until,fence) values (${reservation},${attempt},${campaign},1,${member},${message},${sequence},${account},current_date,${account},'resend',${generation},1,repeat('a',64),${lease},now()+interval '5 minutes',1)`;
          await tx`update growth.outreach_reservations set status='submitting',submitted_at=${submittedAt}::timestamptz + interval '321 microseconds',issued_snapshot=${tx.json(snapshot)},issued_snapshot_hash=${bodySha256} where id=${reservation}`;
        });
        const eventId = `event-${randomUUID()}`,
          event = {
            type: "email.delivered",
            created_at: new Date(Date.now() - 1000).toISOString(),
            data: {
              email_id: providerId,
              message_id: "<actual@example.test>",
              from: sender,
              to: [recipient],
              created_at: new Date(Date.now() - 2000).toISOString(),
            },
          };
        const signed = (payload: unknown, id = eventId) => {
          const raw = JSON.stringify(payload),
            now = new Date();
          return {
            raw,
            headers: {
              "svix-id": id,
              "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
              "svix-signature": new Webhook(secret).sign(id, now, raw),
            },
          };
        };
        const send = createResendConfirmation(db, {
          connectionId: account,
          binding,
          webhookSecret: secret,
        });
        const early = signed(event);
        assert.deepEqual(await send(early.raw, early.headers), {
          status: "held",
          reason: "issuer_unknown",
        });
        const proof = {
          version: 1,
          kind: "resend_api_send_email_v1",
          reservationId: reservation,
          accountId: account,
          connectionId: account,
          sendGeneration: generation,
          idempotencyKey: attempt,
          bodySha256,
          providerMessageId: providerId,
        };
        await admin`update growth.outreach_reservations set status='accepted',provider_message_id=${providerId},direct_submission_evidence=${admin.json(proof)} where id=${reservation}`;
        const { executeResendAccountCommand } =
          await import("../../../lib/growth/campaigns/resend-account-control");
        const founderEmail = "j.ntagengwa@faithfulsoftware.dev";
        const founder = {
          email: founderEmail,
          actorId: createHash("sha256").update(founderEmail).digest("hex"),
        };
        const [control] = await admin<
          { version: number }[]
        >`select version from growth.outreach_account_controls where connection_id=${account}`;
        assert.ok(control);
        await assert.rejects(
          executeResendAccountCommand(
            db,
            {
              type: "resend_configure",
              requestId: randomUUID(),
              expectedVersion: control.version,
              binding,
            },
            founder,
            randomUUID(),
            {
              binding,
              sendCredential: "synthetic",
              usageCredential: "synthetic",
            },
          ),
          /runtime_binding_unknown/,
        );
        const wire = signed(event);
        assert.deepEqual(
          await send(wire.raw, {
            ...wire.headers,
            "svix-signature": "v1,invalid",
          }),
          { status: "held", reason: "delivery_unverified" },
        );
        if (scenario === "unsupported_snapshot") {
          assert.deepEqual(await send(wire.raw, wire.headers), {
            status: "held",
            reason: "membership_conflict",
          });
          const [notCredited] = await admin<
            { first: string | null; receipt: unknown; jobs: number }[]
          >`select m.first_confirmation_reservation_id as first,r.confirmation_receipt as receipt,(select count(*)::int from growth.outreach_jobs where campaign_id=${campaign}) as jobs from growth.campaign_memberships m join growth.outreach_reservations r on r.membership_id=m.id where m.id=${member}`;
          assert.deepEqual(notCredited, {
            first: null,
            receipt: null,
            jobs: 0,
          });
          return;
        }
        const wrongGeneration = createResendConfirmation(db, {
          connectionId: account,
          binding: { ...binding, webhookGeneration: randomUUID() },
          webhookSecret: secret,
        });
        assert.deepEqual(await wrongGeneration(wire.raw, wire.headers), {
          status: "held",
          reason: "webhook_binding_unknown",
        });
        const wrongAccount = createResendConfirmation(db, {
          connectionId: randomUUID(),
          binding,
          webhookSecret: secret,
        });
        assert.deepEqual(await wrongAccount(wire.raw, wire.headers), {
          status: "held",
          reason: "issuer_unknown",
        });
        const wrongSendGeneration = createResendConfirmation(db, {
          connectionId: account,
          binding: { ...binding, sendGeneration: randomUUID() },
          webhookSecret: secret,
        });
        assert.deepEqual(await wrongSendGeneration(wire.raw, wire.headers), {
          status: "held",
          reason: "webhook_binding_unknown",
        });
        const past = signed({
          ...event,
          created_at: new Date(submittedAt.getTime() - 1000).toISOString(),
          data: {
            ...event.data,
            created_at: new Date(submittedAt.getTime() - 2000).toISOString(),
          },
        });
        assert.deepEqual(await send(past.raw, past.headers), {
          status: "held",
          reason: "delivery_time_unknown",
        });
        const microsecondBefore = submittedAt
          .toISOString()
          .replace("Z", "221Z");
        const boundary = signed({
          ...event,
          created_at: microsecondBefore,
          data: { ...event.data, created_at: undefined },
        });
        assert.deepEqual(await send(boundary.raw, boundary.headers), {
          status: "held",
          reason: "delivery_time_unknown",
        });
        const future = signed({
          ...event,
          created_at: new Date(Date.now() + 60000).toISOString(),
        });
        assert.deepEqual(await send(future.raw, future.headers), {
          status: "held",
          reason: "delivery_time_unknown",
        });
        const wrongRecipient = signed({
          ...event,
          data: { ...event.data, to: ["other@example.test"] },
        });
        assert.deepEqual(
          await send(wrongRecipient.raw, wrongRecipient.headers),
          {
            status: "held",
            reason: "issuer_unproven",
          },
        );
        const wrongSender = signed({
          ...event,
          data: { ...event.data, from: "other@example.test" },
        });
        assert.deepEqual(await send(wrongSender.raw, wrongSender.headers), {
          status: "held",
          reason: "delivery_unverified",
        });
        const fakeReview = randomUUID();
        await admin`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${fakeReview},${account},${randomUUID()},repeat('a',64),repeat('c',64),'resend_configure',${admin.json({ binding })},3)`;
        await admin`update growth.outreach_account_controls set resend_binding_review_id=${fakeReview} where connection_id=${account}`;
        assert.deepEqual(await send(wire.raw, wire.headers), {
          status: "held",
          reason: "webhook_binding_unknown",
        });
        await admin`update growth.outreach_account_controls set resend_binding_review_id=${review} where connection_id=${account}`;
        await admin`insert into growth.resend_delivery_events(provider_event_id,event_type,occurred_at,recipient_normalised_email) values (${eventId},'email.opened',now(),${recipient})`;
        assert.deepEqual(await send(wire.raw, wire.headers), {
          status: "held",
          reason: "delivery_conflict",
        });
        const [noReceipt] = await admin<
          { receipt: unknown }[]
        >`select confirmation_receipt as receipt from growth.outreach_reservations where id=${reservation}`;
        assert.equal(noReceipt?.receipt, null);
        await admin`delete from growth.resend_delivery_events where provider_event_id=${eventId}`;
        if (scenario === "paused" || scenario === "stopped")
          await admin`update growth.campaign_memberships set status=${scenario} where id=${member}`;
        if (scenario === "revoked")
          await admin`update growth.campaigns set status='revoked' where id=${campaign} and version=1`;
        if (scenario === "prior_reply")
          await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,received_at) values (${randomUUID()},${sequence},${prospect},${contact},'gmail','inbound',0,'received',${randomUUID()},now())`;
        // This isolated fixture temporarily removes only the direct application
        // audit INSERT privilege to force the transaction's final step to fail.
        await admin`revoke insert on growth.audit_log from growth_app`;
        try {
          await assert.rejects(
            send(wire.raw, wire.headers),
            /permission denied/,
          );
        } finally {
          await admin`grant insert on growth.audit_log to growth_app`;
        }
        const [afterFailure] = await admin<
          { receipt: unknown; events: number }[]
        >`select confirmation_receipt as receipt,(select count(*)::int from growth.resend_delivery_events where outreach_reservation_id=${reservation}) as events from growth.outreach_reservations where id=${reservation}`;
        assert.deepEqual(afterFailure, { receipt: null, events: 0 });
        const [rollback] = await admin<
          {
            first: string | null;
            jobs: number;
            provider: string | null;
            rfc: string | null;
          }[]
        >`select m.first_confirmation_reservation_id as first,(select count(*)::int from growth.outreach_jobs where campaign_id=${campaign}) as jobs,(select count(*)::int from growth.outreach_events where campaign_id=${campaign}) as "eventCount",em.provider_message_id as provider,em.rfc_message_id as rfc from growth.campaign_memberships m join growth.email_messages em on em.id=${message} where m.id=${member}`;
        assert.deepEqual(rollback, {
          first: null,
          jobs: 0,
          eventCount: 0,
          provider: null,
          rfc: null,
        });
        const [first, concurrent] = await Promise.all([
          send(wire.raw, wire.headers),
          send(wire.raw, wire.headers),
        ]);
        if (first.status !== "ready") throw new Error(first.reason);
        if (concurrent.status !== "ready") throw new Error(concurrent.reason);
        assert.deepEqual([first.value.replay, concurrent.value.replay].sort(), [
          false,
          true,
        ]);
        assert.equal(first.value.receipt.basis, "resend_fss_delivery_observed");
        assert.equal(first.value.receipt.rfcMessageId, "<actual@example.test>");
        assert.equal(
          first.value.receipt.possibleInvocationFrom,
          submittedAt.toISOString(),
        );
        const [precision] = await admin<
          { observed: string }[]
        >`select to_char(confirmation_observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as observed from growth.outreach_reservations where id=${reservation}`;
        assert.equal(precision?.observed, first.value.receipt.observedAt);
        const [frozen] = await admin<
          { first: string; snapshot: unknown }[]
        >`select first_confirmation_reservation_id as first,confirmed_snapshot as snapshot from growth.campaign_memberships where id=${member}`;
        const [eventRecord] = await admin<
          { type: string; outbox: number }[]
        >`select e.event_type as type,(select count(*)::int from growth.outreach_outbox o where o.event_id=e.id) as outbox from growth.outreach_events e where e.id=${reservation} and e.membership_id=${member}`;
        assert.deepEqual(eventRecord, {
          type: "resend_delivery_observed",
          outbox: 1,
        });
        assert.equal(frozen?.first, reservation);
        assert.deepEqual(frozen?.snapshot, snapshot.campaign);
        const followups = await admin<
          { status: string; channel: string; step: number }[]
        >`select j.status,em.channel,em.step_number as step from growth.outreach_jobs j join growth.email_messages em on em.idempotency_key=j.idempotency_key where j.membership_id=${member} and j.job_type='follow_up' order by step`;
        const followupStatus =
          scenario === "stopped" || scenario === "prior_reply"
            ? "cancelled"
            : "held";
        assert.deepEqual(Array.from(followups), [
          { status: followupStatus, channel: "resend", step: 1 },
          { status: followupStatus, channel: "resend", step: 2 },
        ]);
        const [report] = await admin<
          { anchor: string; due: Date }[]
        >`select anchor_reservation_id as anchor,due_at as due from growth.outreach_jobs where campaign_id=${campaign} and job_type='monthly_report'`;
        assert.equal(report?.anchor, reservation);
        const { campaignSchedulingAnchor, campaignMonthAnniversary } =
          await import("../../../lib/growth/campaigns/time");
        const hasSub = first.value.receipt.observedAt.slice(23, 26) !== "000";
        const scheduled = campaignSchedulingAnchor(
          new Date(first.value.receipt.observedAt),
          first.value.receipt.basis,
          hasSub,
        );
        assert.equal(
          report?.due.getTime(),
          campaignMonthAnniversary(scheduled).getTime(),
        );
        const { TZDateMini } = await import("@date-fns/tz");
        const dueRows = await admin<
          { due: Date }[]
        >`select due_at as due from growth.outreach_jobs where membership_id=${member} and job_type='follow_up' order by idempotency_key`;
        assert.equal(dueRows.length, 2);
        for (const [index, days] of [5, 10].entries()) {
          const local = new TZDateMini(scheduled.getTime(), "Europe/London");
          local.setDate(local.getDate() + days);
          assert.equal(dueRows[index]?.due.getTime(), local.getTime());
        }
        const [messageEvidence] = await admin<
          { provider: string; rfc: string; sent: Date | null; status: string }[]
        >`select provider_message_id as provider,rfc_message_id as rfc,sent_at as sent,status from growth.email_messages where id=${message}`;
        assert.deepEqual(messageEvidence, {
          provider: providerId,
          rfc: "<actual@example.test>",
          sent: null,
          status: "queued",
        });
        const second = await send(wire.raw, wire.headers);
        if (second.status !== "ready") throw new Error(second.reason);
        assert.equal(second.value.replay, true);
        const changed = signed({
          ...event,
          data: { ...event.data, message_id: "<other@example.test>" },
        });
        assert.deepEqual(await send(changed.raw, changed.headers), {
          status: "held",
          reason: "membership_conflict",
        });
        const distinctEvent = signed(event, `other-${randomUUID()}`);
        assert.deepEqual(await send(distinctEvent.raw, distinctEvent.headers), {
          status: "held",
          reason: "delivery_conflict",
        });
        await assert.rejects(
          db`update growth.resend_delivery_events set outreach_body_sha256=${"b".repeat(64)} where outreach_reservation_id=${reservation}`,
        );
        await assert.rejects(
          admin`update growth.outreach_reservations set confirmation_receipt='{}' where id=${reservation}`,
          /immutable/,
        );
        const [stored] = await admin<
          {
            rfc: string | null;
            thread: string | null;
            sent: Date | null;
            epoch: number | null;
          }[]
        >`select rfc_message_id as rfc,provider_thread_id as thread,actual_sent_at as sent,grant_epoch as epoch from growth.outreach_reservations where id=${reservation}`;
        assert.deepEqual(stored, {
          rfc: null,
          thread: null,
          sent: null,
          epoch: null,
        });
      } finally {
        try {
          await admin`delete from growth.audit_log where entity_id=${reservation}`;
          await admin`delete from growth.resend_delivery_events where outreach_reservation_id=${reservation}`;
          await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaign})`;
          await admin`delete from growth.outreach_events where campaign_id=${campaign}`;
          await admin`delete from growth.outreach_jobs where campaign_id=${campaign}`;
          await admin.begin(async (tx) => {
            await tx`alter table growth.campaign_memberships disable trigger protect_campaign_confirmation`;
            await tx`update growth.campaign_memberships set first_confirmation_reservation_id=null,confirmed_snapshot=null where id=${member}`;
            await tx`alter table growth.campaign_memberships enable trigger protect_campaign_confirmation`;
          });
          await admin`delete from growth.outreach_reservations where id=${reservation}`;
          await admin`delete from growth.campaign_memberships where id=${member}`;
          await admin`delete from growth.email_messages where sequence_enrollment_id=${sequence}`;
          await admin`delete from growth.sequence_enrollments where id=${sequence}`;
          await admin`delete from growth.prospects where id=${prospect}`;
          await admin`delete from growth.contacts where id=${contact}`;
          await admin`delete from growth.businesses where id=${business}`;
          await admin`delete from growth.campaigns where id=${campaign}`;
          await admin`update growth.outreach_account_controls set resend_binding_review_id=null where connection_id=${account}`;
          await admin`delete from growth.outreach_account_reviews where connection_id=${account}`;
          await admin`delete from growth.outreach_account_controls where connection_id=${account}`;
          await admin`delete from growth.outreach_provider_usage where account_id=${account}`;
          await admin`delete from growth.integration_connections where id=${account}`;
        } finally {
          await db.end();
          await admin.end();
        }
      }
    },
  );
}
