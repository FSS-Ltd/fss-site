import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { executeResendAccountCommand } from "../../../lib/growth/campaigns/resend-account-control";
import { refreshResendAccountUsage } from "../../../lib/growth/campaigns/resend-account-repository";

const url = process.env.DIRECT_DATABASE_URL;

test(
  "Resend campaign policy requires the current reviewed account and retains immutable provider binding",
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
    const env = {
      RESEND_OUTREACH_TEAM: binding.team,
      RESEND_OUTREACH_ENVIRONMENT: binding.environment,
      RESEND_OUTREACH_FROM_EMAIL: binding.sender,
      RESEND_OUTREACH_REPLY_TO_EMAIL: binding.replyTo,
      RESEND_OUTREACH_SEND_GENERATION: binding.sendGeneration,
      RESEND_OUTREACH_USAGE_GENERATION: binding.usageGeneration,
      RESEND_OUTREACH_SEND_API_KEY: runtime.sendCredential,
      RESEND_OUTREACH_USAGE_API_KEY: runtime.usageCredential,
    };
    const original = Object.fromEntries(
      Object.keys(env).map((key) => [key, process.env[key]]),
    );
    const originalVercel = process.env.VERCEL_ENV;
    const gmailId = randomUUID();
    const now = Date.now();
    const evidence = {
      summary: "Founder review",
      reference: { kind: "private" as const, value: "review-1" },
      observedAt: new Date(now - 2000),
      expiresAt: new Date(now + 86400000),
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${gmailId},'gmail',${binding.replyTo},'connected','reply-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
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
      await refreshResendAccountUsage(
        db,
        configured.connectionId,
        runtime,
        async () => {
          const time = Date.now();
          return Response.json({
            object: "usage",
            emails: {
              daily: {
                used: 10,
                sent: 8,
                received: 2,
                limit: 100,
                resets_at: new Date(time + 86400000).toISOString(),
              },
              monthly: {
                used: 100,
                sent: 80,
                received: 20,
                limit: null,
                resets_at: new Date(time + 864000000).toISOString(),
              },
            },
            rate_limit: { limit: 10, duration: "1000ms" },
          });
        },
      );
      const health = {
        source: "review",
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
          expectedVersion: configured.version,
          connectionId: configured.connectionId,
          evidence: health,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const active = await executeResendAccountCommand(
        db,
        {
          type: "activate",
          requestId: randomUUID(),
          expectedVersion: healthResult.version,
          connectionId: configured.connectionId,
        },
        founder,
        randomUUID(),
        runtime,
      );
      const policy = {
        version: 1,
        accountConnectionId: configured.connectionId,
        status: "paused" as const,
        approvedAt: null,
        approverId: null,
        effectiveAt: new Date(now - 1000),
        expiresAt: new Date(now + 86400000),
        offer: "review",
        capabilityEvidence: "review-1",
        jurisdiction: "GB",
        provider: "resend" as const,
        permissionRequirement: "consent" as const,
        recipientTimezone: "Europe/London",
        sendWeekdays: [1, 2, 3, 4, 5],
        windowStart: "09:00",
        windowEnd: "17:00",
        dailyLimit: 25 as const,
        providerReserve: 50,
        haltThresholds: { hardBounces: 1, complaints: 1 },
        variants: [
          { id: "a", version: 1, cta: "Would this help?" },
          { id: "b", version: 1, cta: "May I send details?" },
        ],
        cadenceFamily: "review" as const,
        capabilityAttestation: evidence,
        providerAttestation: {
          ...evidence,
          provider: "resend" as const,
          jurisdiction: "GB",
          confirmed: true as const,
        },
      };
      delete process.env.RESEND_OUTREACH_TEAM;
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "create",
            requestId: randomUUID(),
            name: "missing runtime",
            policy,
          },
          founder,
          randomUUID(),
        ),
        /invalid_account_binding/,
      );
      Object.assign(process.env, env);
      delete process.env.VERCEL_ENV;
      const unbound = await executeCampaignCommand(
        db,
        {
          type: "create",
          requestId: randomUUID(),
          name: "unbound resend",
          policy: {
            ...policy,
            accountConnectionId: null,
            permissionRequirement: "requested_service",
          },
        },
        founder,
        randomUUID(),
      );
      const [unboundRow] =
        await admin`select account_provider from growth.campaigns where id=${unbound.id}`;
      assert.equal(unboundRow?.account_provider, "gmail");
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "approve",
            requestId: randomUUID(),
            campaignId: unbound.id,
            policyVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /policy_not_approvable/,
      );
      const created = await executeCampaignCommand(
        db,
        {
          type: "create",
          requestId: randomUUID(),
          name: "bound resend",
          policy,
        },
        founder,
        randomUUID(),
      );
      const [row] =
        await admin`select account_provider,account_connection_id from growth.campaigns where id=${created.id}`;
      assert.equal(row?.account_provider, "resend");
      assert.equal(row?.account_connection_id, configured.connectionId);
      await assert.rejects(
        admin`update growth.campaigns set account_connection_id=null where id=${created.id}`,
      );
      await assert.rejects(
        admin`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${randomUUID()},1,${randomUUID()},'wrong',${admin.json({ accountConnectionId: gmailId, provider: "resend" })},${gmailId})`,
      );
      process.env.RESEND_OUTREACH_SEND_GENERATION = randomUUID();
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "approve",
            requestId: randomUUID(),
            campaignId: created.id,
            policyVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /identity_or_configuration_unknown/,
      );
      process.env.RESEND_OUTREACH_SEND_GENERATION = binding.sendGeneration;
      const halted = await executeResendAccountCommand(
        db,
        {
          type: "halt",
          requestId: randomUUID(),
          expectedVersion: active.version,
          connectionId: configured.connectionId,
          reason: "fixture",
        },
        founder,
        randomUUID(),
        runtime,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "approve",
            requestId: randomUUID(),
            campaignId: created.id,
            policyVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /account_not_active/,
      );
      await executeResendAccountCommand(
        db,
        {
          type: "activate",
          requestId: randomUUID(),
          expectedVersion: halted.version,
          connectionId: configured.connectionId,
        },
        founder,
        randomUUID(),
        runtime,
      );
      await executeCampaignCommand(
        db,
        {
          type: "approve",
          requestId: randomUUID(),
          campaignId: created.id,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      );
      await executeCampaignCommand(
        db,
        {
          type: "resume",
          requestId: randomUUID(),
          campaignId: created.id,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      );
      await executeCampaignCommand(
        db,
        {
          type: "pause",
          requestId: randomUUID(),
          campaignId: created.id,
          policyVersion: 1,
        },
        founder,
        randomUUID(),
      );
      await admin`update growth.integration_connections set status='disconnected' where id=${gmailId}`;
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "resume",
            requestId: randomUUID(),
            campaignId: created.id,
            policyVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /identity_or_configuration_unknown/,
      );
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      if (originalVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = originalVercel;
      await db.end();
      await admin.end();
    }
  },
);
