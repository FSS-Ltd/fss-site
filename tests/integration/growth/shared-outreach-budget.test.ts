import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { executeAccountControlCommand } from "../../../lib/growth/campaigns/account-control";
import { executeResendAccountCommand } from "../../../lib/growth/campaigns/resend-account-control";
import { refreshResendAccountUsage } from "../../../lib/growth/campaigns/resend-account-repository";
import { loadSharedOutreachBudget } from "../../../lib/growth/campaigns/shared-outreach-budget";
import { authorityGate } from "../../../lib/growth/campaigns/authority-gate";
import { londonDayKey } from "../../../lib/growth/campaigns/time";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { exerciseSharedLedger } from "./shared-outreach-ledger";
import { withTransitionClock } from "./reservation-clock";
import type { GmailDueContext } from "../../../lib/growth/campaigns/gmail-due-context";
import { lockGmailRouting } from "../../../lib/growth/sequences/gmail-thread-association";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "shared ramp reads real account controls and serializes reductions",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 2 });
    const db = postgres(url, {
      max: 4,
      connection: { options: "-c role=growth_app" },
    });
    const email = "j.ntagengwa@faithfulsoftware.dev";
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const gmailId = randomUUID(),
      suffix = randomUUID().slice(0, 8);
    const binding = {
      team: `team-${suffix}`,
      environment: "production" as const,
      sender: `outreach@${suffix}.example.test`,
      domain: `${suffix}.example.test`,
      replyTo: email,
      sendGeneration: randomUUID(),
      usageGeneration: randomUUID(),
      webhookGeneration: randomUUID(),
    };
    const runtime = {
      binding,
      sendCredential: "send-secret",
      usageCredential: "usage-secret",
      webhookSecret: "synthetic-webhook",
    };
    const env = {
      RESEND_OUTREACH_TEAM: binding.team,
      RESEND_OUTREACH_ENVIRONMENT: binding.environment,
      RESEND_OUTREACH_FROM_EMAIL: binding.sender,
      RESEND_OUTREACH_REPLY_TO_EMAIL: binding.replyTo,
      RESEND_OUTREACH_SEND_GENERATION: binding.sendGeneration,
      RESEND_OUTREACH_USAGE_GENERATION: binding.usageGeneration,
      RESEND_OUTREACH_WEBHOOK_GENERATION: binding.webhookGeneration,
      RESEND_OUTREACH_WEBHOOK_SECRET: runtime.webhookSecret,
      GROWTH_OS_RESEND_OUTREACH_ENABLED: "true",
      RESEND_OUTREACH_SEND_API_KEY: runtime.sendCredential,
      RESEND_OUTREACH_USAGE_API_KEY: runtime.usageCredential,
    };
    const original = Object.fromEntries(
      Object.keys(env).map((key) => [key, process.env[key]]),
    );
    const originalVercel = process.env.VERCEL_ENV;
    const now = Date.now();
    const health = {
      source: "fixture review",
      observedFrom: new Date(now - 3600000),
      observedUntil: new Date(now - 1000),
      expiresAt: new Date(now + 3600000),
      complete: true,
      verdict: "healthy" as const,
      sends: 10,
      attempts: 10,
      hardBounces: 0,
      complaints: 0,
      rateIncidents: 0,
      authIncidents: 0,
      authentication: {
        spf: { status: "pass" as const, source: "review" },
        dkim: { status: "pass" as const, source: "review" },
        dmarc: { status: "pass" as const, source: "review" },
      },
    };
    const limits = {
      source: "fixture review",
      edition: "workspace",
      path: "gmail",
      observedAt: new Date(now - 1000),
      expiresAt: new Date(now + 86400000),
      messages: 500,
      recipients: [1000, 1000, 1000, 1000] as [number, number, number, number],
      perMessage: 100,
      messageReserve: 50,
      recipientReserve: 10,
      visibility: {
        source: "review",
        scope: "mailbox",
        reviewedAt: new Date(now - 1000),
        expiresAt: new Date(now + 3600000),
        paths: {
          mailbox: "covered" as const,
          aliases: "covered" as const,
          delegates: "covered" as const,
          automatic: "covered" as const,
        },
        recipientHeaders: "complete" as const,
        supportedPaths: {
          nativeMailbox: "included" as const,
          fssGmailApi: "included" as const,
          aliases: "none" as const,
          delegation: "none" as const,
          other: "none" as const,
        },
      },
    };
    const snapshot = [
      {
        id: "one",
        transitionId: "200:added:one",
        internalDate: new Date(now - 2000).toISOString(),
        observedUpperBound: new Date(now - 1000).toISOString(),
        recipientCount: 1,
        recipientFingerprint: "a".repeat(64),
      },
    ];
    let resendId: string | null = null;
    const coverageId = randomUUID();
    try {
      Object.assign(process.env, env);
      delete process.env.VERCEL_ENV;
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${gmailId},'gmail',${email},'connected','fixture-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      await executeAccountControlCommand(
        db,
        {
          type: "record_limits",
          requestId: randomUUID(),
          expectedVersion: 1,
          evidence: limits,
        },
        founder,
        randomUUID(),
      );
      await executeAccountControlCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: 2,
          evidence: health,
        },
        founder,
        randomUUID(),
      );
      await admin`insert into growth.outreach_provider_usage(account_id,connection_id,grant_epoch,complete,health,captured_at,window_start,history_start,history_end,fresh_until,evidence_version,provider_message_ids,rolling_messages,rolling_recipients,observation_subject,observation_scopes,observation_revision) values (${gmailId},${gmailId},1,true,'healthy',now(),now()-interval '24 hours','100','200',now()+interval '4 minutes',2,${admin.json(snapshot)},1,1,'fixture-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]},1)`;
      await executeAccountControlCommand(
        db,
        { type: "activate", requestId: randomUUID(), expectedVersion: 3 },
        founder,
        randomUUID(),
      );

      const configured = await executeResendAccountCommand(
        db,
        {
          type: "resend_configure",
          requestId: randomUUID(),
          expectedVersion: 0,
          binding,
        },
        founder,
        randomUUID(),
        runtime,
      );
      resendId = configured.connectionId;
      const usage = await refreshResendAccountUsage(
        db,
        resendId,
        runtime,
        async () => {
          const time = Date.now();
          return Response.json({
            object: "usage",
            emails: {
              daily: {
                used: 1,
                sent: 1,
                received: 0,
                limit: 100,
                resets_at: new Date(time + 86400000).toISOString(),
              },
              monthly: {
                used: 1,
                sent: 1,
                received: 0,
                limit: null,
                resets_at: new Date(time + 864000000).toISOString(),
              },
            },
            rate_limit: { limit: 10, duration: "1000ms" },
          });
        },
      );
      assert.equal(usage.status, "complete");
      await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: 2,
          connectionId: resendId,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      await executeResendAccountCommand(
        db,
        {
          type: "activate",
          requestId: randomUUID(),
          expectedVersion: 3,
          connectionId: resendId,
        },
        founder,
        randomUUID(),
        runtime,
      );
      await admin`update growth.integration_connections set provider_cursor='200' where id=${gmailId}`;
      await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state) values (${coverageId},${gmailId},1,'fixture-subject','100','200',${new Date(now - 10000)},${new Date(now - 1000)},${new Date(now - 1000)},${new Date(now - 1000)},'complete')`;
      // The server-only branded context is represented by a local fake, backed by actual fixture rows.
      const gmailContext = {
        bound: {
          binding: {
            connectionId: gmailId,
            googleSubject: "fixture-subject",
            grantEpoch: 1,
            grantedScopes: [
              "openid",
              "email",
              "https://www.googleapis.com/auth/gmail.modify",
            ],
          },
        },
        coverageId,
        usage: { status: "complete" },
      } as unknown as GmailDueContext;
      const read = (
        resendDelivery: "enabled" | "unavailable" = "unavailable",
      ) =>
        withGrowthTransaction(db, async (tx) => {
          await lockGmailRouting(tx);
          return loadSharedOutreachBudget(tx, {
            resendDelivery,
            ...(resendDelivery === "enabled" ? { gmailContext } : {}),
          });
        });
      let common = await read();
      assert.equal(common.status === "ready" && common.ramp, 25);
      await exerciseSharedLedger(admin, db, gmailId, email);

      await admin`update growth.outreach_account_controls set last_ramp_at=now()-interval '2 hours' where connection_id=${gmailId}`;
      await executeAccountControlCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: 4,
          evidence: health,
        },
        founder,
        randomUUID(),
      );
      await executeAccountControlCommand(
        db,
        {
          type: "approve_ramp",
          requestId: randomUUID(),
          expectedVersion: 5,
          ramp: 50,
        },
        founder,
        randomUUID(),
      );
      await executeAccountControlCommand(
        db,
        { type: "activate", requestId: randomUUID(), expectedVersion: 6 },
        founder,
        randomUUID(),
      );
      common = await read();
      assert.equal(common.status === "ready" && common.ramp, 50);

      let entered = () => {},
        release = () => {};
      const enteredLock = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const releaseLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      const blocking = withGrowthTransaction(db, async (tx) => {
        await lockGmailRouting(tx);
        await tx`select pg_advisory_xact_lock(hashtextextended('growth:outreach-day:' || ((clock_timestamp() at time zone 'Europe/London')::date + 1)::text,0))`;
        entered();
        await releaseLock;
      });
      await enteredLock;
      let finished = false;
      const reduce = executeAccountControlCommand(
        db,
        {
          type: "reduce_ramp",
          requestId: randomUUID(),
          expectedVersion: 7,
          ramp: 25,
        },
        founder,
        randomUUID(),
      ).then(() => {
        finished = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(finished, false);
      release();
      await Promise.all([blocking, reduce]);
      common = await read();
      assert.equal(common.status === "ready" && common.ramp, 25);

      await admin`update growth.outreach_account_controls set last_ramp_at=now()-interval '2 hours' where connection_id=${resendId}`;
      await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: 4,
          connectionId: resendId,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      await executeResendAccountCommand(
        db,
        {
          type: "activate",
          requestId: randomUUID(),
          expectedVersion: 5,
          connectionId: resendId,
        },
        founder,
        randomUUID(),
        runtime,
      );
      await executeResendAccountCommand(
        db,
        {
          type: "approve_ramp",
          requestId: randomUUID(),
          expectedVersion: 6,
          connectionId: resendId,
          ramp: 50,
        },
        founder,
        randomUUID(),
        runtime,
      );
      common = await read();
      assert.equal(common.status === "ready" && common.ramp, 25);
      await exerciseSharedLedger(admin, db, gmailId, email);
      common = await read("enabled");
      assert.equal(common.status === "ready" && common.ramp, 50);
      process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED = "false";
      common = await read("enabled");
      assert.equal(common.status === "ready" && common.ramp, 25);
      process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED = "true";
      const noContext = await withGrowthTransaction(db, async (tx) => {
        await lockGmailRouting(tx);
        return loadSharedOutreachBudget(tx, { resendDelivery: "enabled" });
      });
      assert.equal(noContext.status === "ready" && noContext.ramp, 25);
      await admin`update growth.integration_connections set provider_cursor='201' where id=${gmailId}`;
      common = await read("enabled");
      assert.equal(common.status === "ready" && common.ramp, 25);
      await admin`update growth.integration_connections set provider_cursor='200' where id=${gmailId}`;
      const [usageRow] =
        await admin`select resend_usage->>'validUntil' as expiry from growth.outreach_provider_usage where connection_id=${resendId}`;
      if (common.status === "ready")
        assert.ok(
          common.bounds.expiresAt.getTime() <= Date.parse(usageRow?.expiry),
        );
      const earlierExpiry = new Date(Date.now() + 15000);
      await admin`update growth.outreach_provider_usage set resend_usage=jsonb_set(resend_usage,'{validUntil}',to_jsonb(${earlierExpiry.toISOString()}::text)) where connection_id=${resendId}`;
      const expiring = await read("enabled");
      assert.equal(expiring.status, "ready");
      if (expiring.status === "ready") {
        const started = new Date();
        const clocked = withTransitionClock(
          db,
          started,
          new Date(earlierExpiry.getTime() + 10),
          false,
          1,
        );
        const gate = await withGrowthTransaction(clocked, async (tx) => {
          const [row] = await tx<
            { intervalOk: boolean }[]
          >`with ${authorityGate(tx, londonDayKey(started), expiring.bounds, null)} select day_ok as "dayOk",interval_ok as "intervalOk",window_ok as "windowOk",0::int as writes from authority_gate`;
          return row;
        });
        assert.equal(gate?.intervalOk, false);
      }
      await admin`update growth.outreach_provider_usage set resend_usage=jsonb_set(resend_usage,'{validUntil}',to_jsonb(${usageRow?.expiry}::text)) where connection_id=${resendId}`;
      await admin`update growth.outreach_provider_usage set complete=false where connection_id=${resendId}`;
      common = await read("enabled");
      assert.equal(common.status === "ready" && common.ramp, 25);
      await exerciseSharedLedger(admin, db, gmailId, email);
      await admin`update growth.outreach_provider_usage set complete=true where connection_id=${resendId}`;
      process.env.RESEND_OUTREACH_SEND_GENERATION = randomUUID();
      common = await read("enabled");
      assert.equal(common.status === "ready" && common.ramp, 25);
      process.env.RESEND_OUTREACH_SEND_GENERATION = binding.sendGeneration;
      let resendEntered = () => {};
      let releaseResend = () => {};
      const resendEnteredLock = new Promise<void>((resolve) => {
        resendEntered = resolve;
      });
      const releaseResendLock = new Promise<void>((resolve) => {
        releaseResend = resolve;
      });
      const resendBlocking = withGrowthTransaction(db, async (tx) => {
        await lockGmailRouting(tx);
        resendEntered();
        await releaseResendLock;
      });
      await resendEnteredLock;
      let resendFinished = false;
      const halt = executeResendAccountCommand(
        db,
        {
          type: "halt",
          requestId: randomUUID(),
          expectedVersion: 7,
          connectionId: resendId,
          reason: "fixture",
        },
        founder,
        randomUUID(),
        runtime,
      ).then(() => {
        resendFinished = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(resendFinished, false);
      releaseResend();
      await Promise.all([resendBlocking, halt]);
      common = await read("enabled");
      assert.equal(common.status === "ready" && common.ramp, 25);
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      if (originalVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = originalVercel;
      await admin`delete from growth.gmail_reply_coverage where id=${coverageId}`;
      for (const id of [resendId, gmailId]) {
        if (!id) continue;
        await admin`delete from growth.outreach_provider_usage where account_id=${id}`;
        await admin`update growth.outreach_account_controls set limits_review_id=null,health_review_id=null,resend_binding_review_id=null where connection_id=${id}`;
        await admin`delete from growth.outreach_account_reviews where connection_id=${id}`;
        await admin`delete from growth.outreach_account_controls where connection_id=${id}`;
        await admin`delete from growth.integration_connections where id=${id}`;
      }
      await db.end();
      await admin.end();
    }
  },
);
