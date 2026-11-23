import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Webhook } from "svix";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import { createResendConfirmation } from "../../../lib/growth/campaigns/resend-confirmation";
import { loadResendFollowUpAnchor } from "../../../lib/growth/campaigns/resend-follow-up-anchor";
import { prepareResendFollowUp } from "../../../lib/growth/campaigns/prepare-follow-up";
import { reserveResendOutreachAttempt } from "../../../lib/growth/campaigns/resend-reservation-repository";
import { submitReservedResendOutreach } from "../../../lib/growth/campaigns/resend-direct-submission";
import { createResendOutreachTransport } from "../../../lib/growth/integrations/resend/outreach-transport";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import type { ResendRuntimeConfiguration } from "../../../lib/growth/campaigns/resend-account-control";

// Replace only database clock reads inside this rollback-only synthetic fixture.
function withFixtureClock(db: GrowthDb, clock: Date): GrowthDb {
  const wrap = <T extends GrowthDb | GrowthTransaction>(tx: T): T =>
    new Proxy(tx, {
      apply(
        target,
        self,
        [strings, ...values]: [TemplateStringsArray, ...unknown[]],
      ) {
        const parts = [...strings].map((part) =>
          part.replaceAll(
            "clock_timestamp()",
            `${"'"}${clock.toISOString()}${"'"}::timestamptz`,
          ),
        );
        return Reflect.apply(target, self, [
          Object.assign(parts, { raw: parts }),
          ...values,
        ]);
      },
    });
  const wrapped = wrap(db);
  return new Proxy(wrapped, {
    get(target, property, receiver) {
      if (property === "begin")
        return (operation: (tx: GrowthTransaction) => Promise<unknown>) =>
          db.begin((tx) => operation(wrap(tx)));
      return Reflect.get(target, property, receiver);
    },
  });
}

export async function exerciseResendFollowUp(
  tx: GrowthTransaction,
  db: GrowthDb,
  input: {
    runtime: ResendRuntimeConfiguration;
    connectionId: string;
    gmailId: string;
    memberId: string;
    recipient: string;
    founderId: string;
  },
) {
  const secret = `whsec_${Buffer.from("synthetic-webhook-secret").toString("base64")}`;
  const eventId = randomUUID();
  const at = new Date();
  const event = JSON.stringify({
    type: "email.delivered",
    created_at: at.toISOString(),
    data: {
      email_id: "synthetic-message-id",
      message_id: "<first@example.test>",
      from: input.runtime.binding.sender,
      to: [input.recipient],
    },
  });
  const confirmed = await createResendConfirmation(db, {
    connectionId: input.connectionId,
    binding: input.runtime.binding,
    webhookSecret: secret,
  })(event, {
    "svix-id": eventId,
    "svix-timestamp": String(Math.floor(at.getTime() / 1000)),
    "svix-signature": new Webhook(secret).sign(eventId, at, event),
  });
  assert.equal(confirmed.status, "ready");
  const [job] = await tx<
    { id: string; due: Date }[]
  >`select id,due_at as due from growth.outreach_jobs where membership_id=${input.memberId} and idempotency_key=${`campaign-followup:${input.memberId}:1`}`;
  assert.ok(job);
  const future = new Date(job.due.getTime() + 1000);
  const before = new Date(future.getTime() - 10000),
    expiry = new Date(future.getTime() + 60000);
  const health = {
    source: "test",
    observedFrom: new Date(future.getTime() - 20000),
    observedUntil: before,
    expiresAt: expiry,
    complete: true,
    verdict: "healthy",
    sends: 100,
    attempts: 100,
    hardBounces: 0,
    complaints: 0,
    rateIncidents: 0,
    authIncidents: 0,
    authentication: {
      spf: { status: "pass", source: "test" },
      dkim: { status: "pass", source: "test" },
      dmarc: { status: "pass", source: "test" },
    },
  };
  const scopes = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.modify",
  ];
  const healthId = randomUUID(),
    gmailHealthId = randomUUID();
  await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${healthId},${input.connectionId},${randomUUID()},repeat('a',64),${input.founderId},'record_health',${tx.json({ evidence: health })},20),(${gmailHealthId},${input.gmailId},${randomUUID()},repeat('b',64),${input.founderId},'record_health',${tx.json({ googleSubject: "test-subject", googleScopes: scopes, evidence: health })},20)`;
  await tx`update growth.outreach_account_controls set health_review_id=case when connection_id=${input.connectionId} then ${healthId}::uuid else ${gmailHealthId}::uuid end where connection_id in (${input.connectionId},${input.gmailId})`;
  const window = {
    used: 1,
    sent: 1,
    received: 0,
    limit: 100,
    resets_at: new Date(future.getTime() + 3600000).toISOString(),
  };
  const usage = {
    observedAt: before.toISOString(),
    validUntil: expiry.toISOString(),
    daily: window,
    monthly: window,
    rateLimit: { limit: 1, duration: "1000ms" },
  };
  await tx`update growth.outreach_provider_usage set resend_usage=${tx.json(usage)} where account_id=${input.connectionId}`;
  await tx`update growth.outreach_provider_usage set observed_at=${before},captured_at=${before},window_start=${new Date(before.getTime() - 86400000)},fresh_until=${expiry} where account_id=${input.gmailId}`;
  const coverageId = randomUUID();
  await tx`update growth.integration_connections set provider_cursor='301' where id=${input.gmailId}`;
  await tx`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state) values (${coverageId},${input.gmailId},1,'test-subject','300','301',${new Date(at.getTime() - 1000)},${before},${before},${before},'complete')`;
  await tx`update growth.outreach_jobs set status='leased',lease_owner='resend-followup-test',lease_revision=lease_revision+1,lease_until=${expiry} where id=${job.id}`;
  const [leased] = await tx<
    { revision: string }[]
  >`select lease_revision::text as revision from growth.outreach_jobs where id=${job.id}`;
  assert.ok(leased);
  const futureDb = withFixtureClock(db, future);
  mock.timers.enable({ apis: ["Date"], now: future });
  try {
    const prepareInput = {
      jobId: job.id,
      leaseOwner: "resend-followup-test",
      leaseRevision: leased.revision,
      connectionId: input.connectionId,
      coverageId,
    };
    const early = await prepareResendFollowUp(
      withFixtureClock(db, new Date(job.due.getTime() - 1)),
      prepareInput,
    );
    assert.deepEqual(early, { status: "held", reason: "job_lease_invalid" });
    await tx`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${input.recipient},'opt_out','manual','test')`;
    assert.deepEqual(await prepareResendFollowUp(futureDb, prepareInput), {
      status: "held",
      reason: "follow_up_excluded",
    });
    await tx`delete from growth.suppressions where normalised_email=${input.recipient}`;
    await tx`update growth.integration_connections set version=version+1 where id=${input.gmailId}`;
    assert.equal(
      (await prepareResendFollowUp(futureDb, prepareInput)).status,
      "held",
    );
    await tx`update growth.integration_connections set version=version-1 where id=${input.gmailId}`;
    assert.equal(
      (
        await prepareResendFollowUp(futureDb, {
          ...prepareInput,
          coverageId: randomUUID(),
        })
      ).status,
      "held",
    );
    const prepared = await prepareResendFollowUp(futureDb, prepareInput);
    assert.equal(prepared.status, "ready", JSON.stringify(prepared));
    if (prepared.status !== "ready") return;
    const leaseToken = randomUUID();
    const claimed = await postgresSequenceDispatchRepository.claimDueMessage(
      futureDb,
      {
        leaseToken,
        now: future,
        leaseExpiresAt: expiry,
        messageId: prepared.value.messageId,
        excludeMessageIds: [],
        channel: "resend",
      },
    );
    assert.equal(claimed?.id, prepared.value.messageId);
    const reserved = await reserveResendOutreachAttempt(futureDb, {
      messageId: prepared.value.messageId,
      leaseToken,
      attemptKey: randomUUID(),
      coverageId,
    });
    assert.equal(reserved.status, "ready", JSON.stringify(reserved));
    if (reserved.status !== "ready") return;
    assert.equal(
      await futureDb.begin((current) =>
        loadResendFollowUpAnchor(current, {
          membershipId: input.memberId,
          connectionId: input.connectionId,
          step: 2,
          runtime: input.runtime,
        }),
      ),
      null,
    );
    const submitInput = {
      reservationId: reserved.value.reservationId,
      leaseToken,
      fence: reserved.value.fence,
      fingerprint: reserved.value.preparation.fingerprint,
      coverageId,
    };
    await tx`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${input.recipient},'opt_out','manual','test')`;
    assert.equal(
      (await submitReservedResendOutreach(futureDb, submitInput)).status,
      "held",
    );
    await tx`delete from growth.suppressions where normalised_email=${input.recipient}`;
    await tx`update growth.integration_connections set version=version+1 where id=${input.gmailId}`;
    assert.equal(
      (await submitReservedResendOutreach(futureDb, submitInput)).status,
      "held",
    );
    await tx`update growth.integration_connections set version=version-1 where id=${input.gmailId}`;
    let posts = 0;
    const result = await submitReservedResendOutreach(
      futureDb,
      {
        reservationId: reserved.value.reservationId,
        leaseToken,
        fence: reserved.value.fence,
        fingerprint: reserved.value.preparation.fingerprint,
        coverageId,
      },
      (credential) =>
        createResendOutreachTransport(credential, {
          request: async (_url, request) => {
            posts++;
            const body = JSON.parse(String(request?.body));
            assert.deepEqual(body.headers, {
              "In-Reply-To": "<first@example.test>",
              References: "<first@example.test>",
            });
            return Response.json({ id: "followup-synthetic-id" });
          },
        }),
    );
    assert.equal(result.status, "accepted", JSON.stringify(result));
    assert.equal(posts, 1);
  } finally {
    mock.timers.reset();
  }
}
