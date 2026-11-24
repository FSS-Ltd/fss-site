import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Webhook } from "svix";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import { createResendConfirmation } from "../../../lib/growth/campaigns/resend-confirmation";
import { createLiveResendOutreachWorker } from "../../../lib/growth/campaigns/resend-outreach-worker";
import { claimResendFollowUps } from "../../../lib/growth/campaigns/resend-follow-up-due";
import { loadResendFollowUpAnchor } from "../../../lib/growth/campaigns/resend-follow-up-anchor";
import { prepareResendFollowUp } from "../../../lib/growth/campaigns/prepare-follow-up";
import { reserveResendOutreachAttempt } from "../../../lib/growth/campaigns/resend-reservation-repository";
import { submitReservedResendOutreach } from "../../../lib/growth/campaigns/resend-direct-submission";
import { createResendOutreachTransport } from "../../../lib/growth/integrations/resend/outreach-transport";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import { classifyGmailRouting } from "../../../lib/growth/sequences/gmail-routing-repository";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import type { GmailDueContext } from "../../../lib/growth/campaigns/gmail-due-context";
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
  let window = {
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
  // Test-only representation; the production route supplies the branded result of its actual sync.
  const gmailContext = {
    bound: {
      binding: {
        connectionId: input.gmailId,
        googleSubject: "test-subject",
        grantEpoch: 1,
        grantedScopes: scopes,
      },
    },
    coverageId,
    usage: { status: "complete" },
  } as unknown as GmailDueContext;
  const futureDb = withFixtureClock(db, future);
  mock.timers.enable({ apis: ["Date"], now: future });
  try {
    const workerRollback = new Error("restore worker fixture");
    const originalFetch = globalThis.fetch;
    let providerReads = 0,
      providerPosts = 0;
    globalThis.fetch = async (resource, init) => {
      if (
        String(resource) === "https://api.resend.com/emails" &&
        init?.method === "POST"
      ) {
        providerPosts++;
        const body = JSON.parse(String(init.body));
        assert.deepEqual(
          body.headers,
          providerPosts === 1
            ? {
                "In-Reply-To": "<first@example.test>",
                References: "<first@example.test>",
              }
            : {
                "In-Reply-To": "<second@example.test>",
                References: "<first@example.test> <second@example.test>",
              },
        );
        return Response.json({
          id:
            providerPosts === 1
              ? "worker-followup-id"
              : "worker-second-followup-id",
        });
      }
      assert.equal(String(resource), "https://api.resend.com/usage");
      assert.equal(init?.method, "GET");
      providerReads++;
      return Response.json({
        object: "usage",
        emails: { daily: window, monthly: window },
        rate_limit: { limit: 1, duration: "1000ms" },
      });
    };
    try {
      await assert.rejects(
        tx.savepoint(async () => {
          const outcome = await createLiveResendOutreachWorker({
            context: gmailContext,
            prepareOnly: true,
          })(futureDb);
          assert.equal(outcome.status, "complete", JSON.stringify(outcome));
          assert.equal(outcome.followUpClaimed, 1);
          assert.equal(outcome.followUpPrepared, 1);
          assert.equal(outcome.followUpHeld, 0);
          throw workerRollback;
        }),
        (error) => error === workerRollback,
      );
      assert.equal(providerReads, 1);
      assert.equal(providerPosts, 0);
      await assert.rejects(
        tx.savepoint(async () => {
          const outcome = await createLiveResendOutreachWorker({
            context: gmailContext,
          })(futureDb);
          assert.equal(outcome.status, "complete", JSON.stringify(outcome));
          assert.equal(outcome.followUpPrepared, 1);
          assert.equal(outcome.accepted, 1);
          const nextEventId = randomUUID();
          const nextEvent = JSON.stringify({
            type: "email.delivered",
            created_at: future.toISOString(),
            data: {
              email_id: "worker-followup-id",
              message_id: "<second@example.test>",
              from: input.runtime.binding.sender,
              to: [input.recipient],
            },
          });
          const delivered = await createResendConfirmation(futureDb, {
            connectionId: input.connectionId,
            binding: input.runtime.binding,
            webhookSecret: secret,
          })(nextEvent, {
            "svix-id": nextEventId,
            "svix-timestamp": String(Math.floor(future.getTime() / 1000)),
            "svix-signature": new Webhook(secret).sign(
              nextEventId,
              future,
              nextEvent,
            ),
          });
          assert.equal(delivered.status, "ready", JSON.stringify(delivered));
          const routingInput = {
            binding: {
              connectionId: input.gmailId,
              googleSubject: "test-subject",
              grantEpoch: 1,
              grantedScopes: scopes,
            },
            threadId: `changed-${randomUUID()}`,
            inReplyTo: "<second@example.test>",
            references: "<first@example.test> <second@example.test>",
            fromAddress: input.recipient,
            fromHeader: input.recipient,
          };
          const routed = await classifyGmailRouting(futureDb, routingInput);
          assert.equal(routed.kind, "unique");
          if (routed.kind !== "unique")
            throw new Error("missing exact reply route");
          assert.equal(
            routed.attribution?.rfcMessageId,
            "<second@example.test>",
          );
          const inboundRollback = new Error("restore inbound fixture");
          await assert.rejects(
            tx.savepoint(async () => {
              const gmailMessageId = `gmail-${randomUUID()}`;
              const observation = {
                messageId: gmailMessageId,
                historyId: "301",
                threadId: routingInput.threadId,
                inReplyTo: routingInput.inReplyTo,
                references: routingInput.references,
                fromAddress: input.recipient,
                fromHeader: input.recipient,
              };
              const recorded =
                await postgresGmailSyncRepository.recordInboundEvent(futureDb, {
                  binding: routingInput.binding,
                  sequenceEnrollmentId: routed.enrollment.id,
                  prospectId: routed.enrollment.prospectId,
                  contactId: routed.enrollment.contactId,
                  gmailMessageId,
                  gmailThreadId: routingInput.threadId,
                  observation,
                  rfcMessageId: `<inbound-${randomUUID()}@example.test>`,
                  from: input.recipient,
                  subject: "A reply",
                  receivedAt: future,
                  eventType: "reply",
                  correlationId: randomUUID(),
                });
              assert.equal(recorded.alreadyRecorded, false);
              const [fact] = await tx<
                { attribution: { rfcMessageId: string } }[]
              >`select e.outreach_reply_attribution as attribution from growth.email_events e join growth.email_messages em on em.id=e.email_message_id where em.provider_message_id=${gmailMessageId}`;
              assert.equal(
                fact?.attribution.rfcMessageId,
                "<second@example.test>",
              );
              throw inboundRollback;
            }),
            (error) => error === inboundRollback,
          );
          assert.equal(
            (
              await classifyGmailRouting(futureDb, {
                ...routingInput,
                inReplyTo: null,
              })
            ).kind,
            "ambiguous",
          );
          const unconfirmed = randomUUID();
          await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,rfc_message_id) select ${unconfirmed},se.id,se.prospect_id,se.contact_id,'resend','outbound',4,'draft',${randomUUID()},'<unconfirmed@example.test>' from growth.sequence_enrollments se join growth.campaign_memberships m on m.sequence_id=se.id where m.id=${input.memberId}`;
          assert.equal(
            (
              await classifyGmailRouting(futureDb, {
                ...routingInput,
                references:
                  routingInput.references + " <unconfirmed@example.test>",
              })
            ).kind,
            "ambiguous",
          );
          await tx`delete from growth.email_messages where id=${unconfirmed}`;
          const [secondJob] = await tx<
            { due: Date }[]
          >`select due_at as due from growth.outreach_jobs where membership_id=${input.memberId} and idempotency_key=${`campaign-followup:${input.memberId}:2`}`;
          assert.ok(secondJob);
          const secondTime = new Date(secondJob.due.getTime() + 1000),
            secondBefore = new Date(secondTime.getTime() - 10000),
            secondExpiry = new Date(secondTime.getTime() + 60000);
          const laterHealth = {
            ...health,
            observedFrom: new Date(secondTime.getTime() - 20000),
            observedUntil: secondBefore,
            expiresAt: secondExpiry,
          };
          const laterResendReview = randomUUID(),
            laterGmailReview = randomUUID();
          await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${laterResendReview},${input.connectionId},${randomUUID()},repeat('c',64),${input.founderId},'record_health',${tx.json({ evidence: laterHealth })},21),(${laterGmailReview},${input.gmailId},${randomUUID()},repeat('d',64),${input.founderId},'record_health',${tx.json({ googleSubject: "test-subject", googleScopes: scopes, evidence: laterHealth })},21)`;
          await tx`update growth.outreach_account_controls set health_review_id=case when connection_id=${input.connectionId} then ${laterResendReview}::uuid else ${laterGmailReview}::uuid end where connection_id in (${input.connectionId},${input.gmailId})`;
          window = {
            ...window,
            resets_at: new Date(secondTime.getTime() + 3600000).toISOString(),
          };
          await tx`update growth.outreach_provider_usage set observed_at=${secondBefore},captured_at=${secondBefore},window_start=${new Date(secondBefore.getTime() - 86400000)},fresh_until=${secondExpiry} where account_id=${input.gmailId}`;
          const secondCoverage = randomUUID();
          await tx`update growth.integration_connections set provider_cursor='302' where id=${input.gmailId}`;
          await tx`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state) values (${secondCoverage},${input.gmailId},1,'test-subject','301','302',${before},${secondBefore},${secondBefore},${secondBefore},'complete')`;
          const secondContext = { ...gmailContext, coverageId: secondCoverage };
          mock.timers.setTime(secondTime.getTime());
          try {
            const secondOutcome = await createLiveResendOutreachWorker({
              context: secondContext,
            })(withFixtureClock(db, secondTime));
            assert.equal(
              secondOutcome.status,
              "complete",
              JSON.stringify(secondOutcome),
            );
            assert.equal(secondOutcome.followUpPrepared, 1);
            assert.equal(secondOutcome.accepted, 1);
          } finally {
            mock.timers.setTime(future.getTime());
          }
          throw workerRollback;
        }),
        (error) => error === workerRollback,
      );
      assert.equal(providerReads, 3);
      assert.equal(providerPosts, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
    const claimInput = {
      connectionId: input.connectionId,
      runtime: input.runtime,
      coverageId,
      workerId: "resend-followup-test",
      limit: 1,
    };
    assert.deepEqual(
      await claimResendFollowUps(futureDb, {
        ...claimInput,
        coverageId: randomUUID(),
      }),
      [],
    );
    const [stillHeld] = await tx<
      { status: string }[]
    >`select status from growth.outreach_jobs where id=${job.id}`;
    assert.equal(stillHeld?.status, "held");
    const [leased] = await claimResendFollowUps(futureDb, claimInput);
    assert.equal(leased?.id, job.id);
    assert.ok(leased);
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
    const reserved = await reserveResendOutreachAttempt(
      futureDb,
      {
        messageId: prepared.value.messageId,
        leaseToken,
        attemptKey: randomUUID(),
        coverageId,
      },
      gmailContext,
    );
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
    process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED = "false";
    assert.deepEqual(
      await submitReservedResendOutreach(
        futureDb,
        submitInput,
        undefined,
        gmailContext,
      ),
      { status: "held", reason: "reply_coverage_unknown" },
    );
    process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED = "true";
    await tx`update growth.integration_connections set provider_cursor='302' where id=${input.gmailId}`;
    assert.deepEqual(
      await submitReservedResendOutreach(
        futureDb,
        submitInput,
        undefined,
        gmailContext,
      ),
      { status: "held", reason: "reply_coverage_unknown" },
    );
    await tx`update growth.integration_connections set provider_cursor='301' where id=${input.gmailId}`;
    await tx`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${input.recipient},'opt_out','manual','test')`;
    assert.equal(
      (
        await submitReservedResendOutreach(
          futureDb,
          submitInput,
          undefined,
          gmailContext,
        )
      ).status,
      "held",
    );
    await tx`delete from growth.suppressions where normalised_email=${input.recipient}`;
    await tx`update growth.integration_connections set version=version+1 where id=${input.gmailId}`;
    assert.equal(
      (
        await submitReservedResendOutreach(
          futureDb,
          submitInput,
          undefined,
          gmailContext,
        )
      ).status,
      "held",
    );
    await tx`update growth.integration_connections set version=version-1 where id=${input.gmailId}`;
    const preflightRollback = new Error("restore preflight fixture");
    await assert.rejects(
      tx.savepoint(async (sp) => {
        const changedDb = new Proxy(futureDb, {
          apply(target, receiver, args: [TemplateStringsArray, ...unknown[]]) {
            if (args[0].join("?").includes('g.id as "monitorId"')) {
              return (async () => {
                await sp`update growth.integration_connections set provider_cursor='302' where id=${input.gmailId}`;
                return Reflect.apply(target, receiver, args);
              })();
            }
            return Reflect.apply(target, receiver, args);
          },
        });
        const stopped = await submitReservedResendOutreach(
          changedDb,
          submitInput,
          () => {
            throw new Error("unexpected network");
          },
          gmailContext,
        );
        assert.deepEqual(stopped, {
          status: "uncertain",
          reason: "binding_changed",
        });
        throw preflightRollback;
      }),
      (error) => error === preflightRollback,
    );
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
      gmailContext,
    );
    assert.equal(result.status, "accepted", JSON.stringify(result));
    assert.equal(posts, 1);
  } finally {
    mock.timers.reset();
  }
}
