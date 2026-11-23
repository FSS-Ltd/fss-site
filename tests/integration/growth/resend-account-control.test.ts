import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { executeResendAccountCommand } from "../../../lib/growth/campaigns/resend-account-control";
import {
  loadResendAccountReadiness,
  refreshResendAccountUsage,
} from "../../../lib/growth/campaigns/resend-account-repository";
import { withGrowthTransaction } from "../../../lib/growth/db/client";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "Resend account binds reviewed configuration and provider usage across rotation",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 3,
      connection: { options: "-c role=growth_app" },
    });
    const email = "j.ntagengwa@faithfulsoftware.dev";
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const suffix = randomUUID().slice(0, 8);
    const binding = {
      team: `team-${suffix}`,
      environment: "production" as const,
      sender: `outreach@${suffix}.example.test`,
      domain: `${suffix}.example.test`,
      replyTo: `reply@${suffix}.example.test`,
      sendGeneration: randomUUID(),
      usageGeneration: randomUUID(),
    };
    const runtime = {
      binding,
      sendCredential: "send-secret",
      usageCredential: "usage-secret",
    };
    const gmailId = randomUUID();
    const request = async (u: string, init?: RequestInit) => {
      assert.equal(u, "https://api.resend.com/usage");
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer usage-secret",
      );
      const clock = Date.now();
      return Response.json({
        object: "usage",
        emails: {
          daily: {
            used: 10,
            sent: 8,
            received: 2,
            limit: 100,
            resets_at: new Date(clock + 86400000).toISOString(),
          },
          monthly: {
            used: 100,
            sent: 80,
            received: 20,
            limit: null,
            resets_at: new Date(clock + 864000000).toISOString(),
          },
        },
        rate_limit: { limit: 10, duration: "1000ms" },
      });
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${gmailId},'gmail',${binding.replyTo},'connected','reply-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      const command = {
        type: "resend_configure" as const,
        requestId: randomUUID(),
        expectedVersion: 0,
        binding,
      };
      const configured = await executeResendAccountCommand(
        db,
        command,
        founder,
        randomUUID(),
        runtime,
      );
      assert.equal(configured.version, 2);
      const [initialControl] =
        await admin`select state from growth.outreach_account_controls where connection_id=${configured.connectionId}`;
      assert.equal(initialControl?.state, "paused");
      const replay = await executeResendAccountCommand(
        db,
        command,
        founder,
        randomUUID(),
        runtime,
      );
      assert.equal(replay.reviewId, configured.reviewId);
      await assert.rejects(
        executeResendAccountCommand(
          db,
          { ...command, requestId: randomUUID() },
          founder,
          randomUUID(),
          runtime,
        ),
        /account_version_changed/,
      );
      const id = configured.connectionId;
      assert.deepEqual(
        await refreshResendAccountUsage(db, id, runtime, request),
        { status: "complete" },
      );
      const now = Date.now();
      const health = {
        source: "founder review",
        observedFrom: new Date(now - 20000),
        observedUntil: new Date(now - 10000),
        expiresAt: new Date(now + 60000),
        complete: true,
        verdict: "healthy" as const,
        sends: 100,
        attempts: 100,
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
      const healthResult = await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: 2,
          connectionId: id,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const activate = await executeResendAccountCommand(
        db,
        {
          type: "activate",
          requestId: randomUUID(),
          expectedVersion: healthResult.version,
          connectionId: id,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const ready = await withGrowthTransaction(db, (tx) =>
        loadResendAccountReadiness(tx, id, runtime),
      );
      assert.equal(ready.status, "ready");
      if (ready.status === "ready")
        assert.deepEqual(ready.monitoredMailbox, {
          connectionId: gmailId,
          googleSubject: "reply-subject",
          grantEpoch: 1,
          address: binding.replyTo,
          grantedScopes: [
            "email",
            "https://www.googleapis.com/auth/gmail.modify",
            "openid",
          ],
        });
      const renewal = await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: activate.version,
          connectionId: id,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const [renewed] =
        await admin`select state from growth.outreach_account_controls where connection_id=${id}`;
      assert.equal(renewed?.state, "active");
      assert.equal(
        (
          await withGrowthTransaction(db, (tx) =>
            loadResendAccountReadiness(tx, id, runtime),
          )
        ).status,
        "ready",
      );
      await admin`update growth.outreach_account_controls set last_ramp_at=now() - interval '2 hours' where connection_id=${id}`;
      const advanced = await executeResendAccountCommand(
        db,
        {
          type: "approve_ramp",
          requestId: randomUUID(),
          expectedVersion: renewal.version,
          connectionId: id,
          ramp: 50,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const unknownReview = await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: advanced.version,
          connectionId: id,
          evidence: { ...health, verdict: "unknown", complete: false },
        },
        founder,
        randomUUID(),
        runtime,
      );
      const [unknown] =
        await admin`select state from growth.outreach_account_controls where connection_id=${id}`;
      assert.equal(unknown?.state, "active");
      assert.deepEqual(
        await withGrowthTransaction(db, (tx) =>
          loadResendAccountReadiness(tx, id, runtime),
        ),
        { status: "held", reason: "health_unknown" },
      );
      const restored = await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: unknownReview.version,
          connectionId: id,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      assert.equal(
        (
          await withGrowthTransaction(db, (tx) =>
            loadResendAccountReadiness(tx, id, runtime),
          )
        ).status,
        "ready",
      );
      const incident = await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: restored.version,
          connectionId: id,
          evidence: { ...health, complaints: 1 },
        },
        founder,
        randomUUID(),
        runtime,
      );
      const [halted] =
        await admin`select state from growth.outreach_account_controls where connection_id=${id}`;
      assert.equal(halted?.state, "halted");
      const afterHalt = await executeResendAccountCommand(
        db,
        {
          type: "record_health",
          requestId: randomUUID(),
          expectedVersion: incident.version,
          connectionId: id,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const [stillHalted] =
        await admin`select state from growth.outreach_account_controls where connection_id=${id}`;
      assert.equal(stillHalted?.state, "halted");
      assert.equal(
        (
          await withGrowthTransaction(db, (tx) =>
            loadResendAccountReadiness(tx, id, runtime),
          )
        ).status,
        "held",
      );
      const reactivated = await executeResendAccountCommand(
        db,
        {
          type: "activate",
          requestId: randomUUID(),
          expectedVersion: afterHalt.version,
          connectionId: id,
        },
        founder,
        randomUUID(),
        runtime,
      );
      assert.equal(
        (
          await withGrowthTransaction(db, (tx) =>
            loadResendAccountReadiness(tx, id, runtime),
          )
        ).status,
        "ready",
      );
      await admin`update growth.integration_connections set status='disconnected' where id=${gmailId}`;
      assert.equal(
        (
          await withGrowthTransaction(db, (tx) =>
            loadResendAccountReadiness(tx, id, runtime),
          )
        ).status,
        "held",
      );
      await admin`update growth.integration_connections set status='connected' where id=${gmailId}`;
      const duplicateBinding = {
        ...binding,
        sender: `other@${binding.domain}`,
      };
      await assert.rejects(
        executeResendAccountCommand(
          db,
          {
            type: "resend_configure",
            requestId: randomUUID(),
            expectedVersion: 0,
            binding: duplicateBinding,
          },
          founder,
          randomUUID(),
          { ...runtime, binding: duplicateBinding },
        ),
        /account_version_changed/,
      );
      const [access] =
        await admin`select has_table_privilege('anon','growth.outreach_account_controls','select') as anon,has_table_privilege('authenticated','growth.outreach_account_reviews','select') as authenticated`;
      assert.equal(access?.anon, false);
      assert.equal(access?.authenticated, false);
      let announce = () => {};
      let release = () => {};
      const started = new Promise<void>((resolve) => {
        announce = resolve;
      });
      const continueRequest = new Promise<void>((resolve) => {
        release = resolve;
      });
      const inFlight = refreshResendAccountUsage(
        db,
        id,
        runtime,
        async (url, init) => {
          announce();
          await continueRequest;
          return request(url, init);
        },
      );
      await started;
      const rotatedBinding = {
        ...binding,
        sendGeneration: randomUUID(),
        usageGeneration: randomUUID(),
      };
      const rotated = { ...runtime, binding: rotatedBinding };
      await executeResendAccountCommand(
        db,
        {
          type: "resend_configure",
          requestId: randomUUID(),
          expectedVersion: reactivated.version,
          binding: rotatedBinding,
        },
        founder,
        randomUUID(),
        rotated,
      );
      release();
      assert.deepEqual(await inFlight, {
        status: "held",
        reason: "observation_superseded",
      });
      const held = await withGrowthTransaction(db, (tx) =>
        loadResendAccountReadiness(tx, id, rotated),
      );
      assert.equal(held.status, "held");
      assert.equal(
        (await refreshResendAccountUsage(db, id, runtime, request)).status,
        "held",
      );
      const [control] =
        await admin`select state,ramp,health_review_id as health from growth.outreach_account_controls where connection_id=${id}`;
      assert.equal(control?.state, "paused");
      assert.equal(control?.ramp, 50);
      assert.equal(control?.health, null);
      const [secrets] =
        await admin`select count(*)::int as count from growth.outreach_account_reviews where connection_id=${id} and (evidence::text like '%send-secret%' or evidence::text like '%usage-secret%')`;
      assert.equal(secrets?.count, 0);
      await assert.rejects(
        admin`update growth.outreach_account_controls set resend_team='other' where connection_id=${id}`,
      );
    } finally {
      await db.end();
      await admin.end();
    }
  },
);
