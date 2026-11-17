import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { campaignPolicyDefinitionSchema } from "../../../lib/growth/campaigns/schemas";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";

const connection = process.env.DIRECT_DATABASE_URL;
test(
  "campaign account binding is validated and immutable across versions",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const admin = postgres(connection, { max: 1 });
    const db = postgres(connection, {
      max: 1,
      connection: { options: "-c role=growth_app" },
    });
    const email = "j.ntagengwa@faithfulsoftware.dev";
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const accountId = randomUUID();
    const otherId = randomUUID();
    const resendId = randomUUID();
    const directCampaignId = randomUUID();
    const unboundCampaignId = randomUUID();
    const now = Date.now();
    const evidence = {
      summary: "Reviewed",
      reference: { kind: "private" as const, value: "review-1" },
      observedAt: new Date(now - 1000),
      expiresAt: new Date(now + 86400000),
    };
    const policy = campaignPolicyDefinitionSchema.parse({
      version: 1,
      accountConnectionId: accountId,
      status: "paused" as const,
      approvedAt: null,
      approverId: null,
      capabilityEvidence: "review-1",
      jurisdiction: "GB",
      provider: "gmail" as const,
      capabilityAttestation: evidence,
      providerAttestation: {
        ...evidence,
        provider: "gmail" as const,
        jurisdiction: "GB",
        confirmed: true as const,
      },
    });
    let campaignId: string | undefined;
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,google_subject,status,granted_scopes) values (${accountId},'gmail',${email},'verified-subject','connected',array['https://www.googleapis.com/auth/gmail.modify']), (${otherId},'gmail',${`other-${randomUUID()}@example.test`},'other-subject','connected',array['https://www.googleapis.com/auth/gmail.modify'])`;
      await admin`insert into growth.integration_connections(id,provider,subject_email,status) values (${resendId},'resend',${`resend-${randomUUID()}@example.test`},'connected')`;
      for (const provider of ["resend", null, undefined] as const) {
        const directPolicy =
          provider === undefined
            ? { accountConnectionId: accountId }
            : { accountConnectionId: accountId, provider };
        await assert.rejects(
          db`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${randomUUID()},1,${randomUUID()},'invalid',${db.json(directPolicy)},${accountId})`,
          /campaign_bound_provider_gmail/,
        );
      }
      await assert.rejects(
        db`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${randomUUID()},1,${randomUUID()},'wrong-provider',${db.json({ accountConnectionId: resendId, provider: "gmail" })},${resendId})`,
        /campaign_gmail_account_fk/,
      );
      await db`insert into growth.campaigns(id,version,request_id,name,policy) values (${unboundCampaignId},1,${randomUUID()},'unbound',${db.json({})})`;
      await db`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${directCampaignId},1,${randomUUID()},'valid',${db.json({ accountConnectionId: accountId, provider: "gmail" })},${accountId})`;
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "create",
            requestId: randomUUID(),
            name: "wrong account",
            policy: { ...policy, accountConnectionId: otherId },
          },
          founder,
          randomUUID(),
        ),
        /invalid_account_binding/,
      );
      for (const change of [
        "unknown_subject",
        "disconnected",
        "missing_scope",
      ] as const) {
        if (change === "unknown_subject")
          await admin`update growth.integration_connections set google_subject=null where id=${accountId}`;
        if (change === "disconnected")
          await admin`update growth.integration_connections set status='revoked' where id=${accountId}`;
        if (change === "missing_scope")
          await admin`update growth.integration_connections set granted_scopes='{}' where id=${accountId}`;
        await assert.rejects(
          executeCampaignCommand(
            db,
            { type: "create", requestId: randomUUID(), name: change, policy },
            founder,
            randomUUID(),
          ),
          /invalid_account_binding/,
        );
        await admin`update growth.integration_connections set google_subject='verified-subject', status='connected', granted_scopes=array['https://www.googleapis.com/auth/gmail.modify'] where id=${accountId}`;
      }
      const created = await executeCampaignCommand(
        db,
        { type: "create", requestId: randomUUID(), name: "bound", policy },
        founder,
        randomUUID(),
      );
      campaignId = created.id;
      const [row] = await admin<
        { account: string; policyAccount: string }[]
      >`select account_connection_id as account, policy->>'accountConnectionId' as "policyAccount" from growth.campaigns where id=${campaignId} and version=1`;
      assert.deepEqual(row, { account: accountId, policyAccount: accountId });
      await assert.rejects(
        admin`update growth.campaigns set account_connection_id=null where id=${campaignId} and version=1`,
      );
      await assert.rejects(
        executeCampaignCommand(
          db,
          {
            type: "revise",
            requestId: randomUUID(),
            campaignId,
            policyVersion: 1,
            policy: { ...policy, version: 2, accountConnectionId: otherId },
          },
          founder,
          randomUUID(),
        ),
        /invalid_account_binding/,
      );
      await executeCampaignCommand(
        db,
        {
          type: "revise",
          requestId: randomUUID(),
          campaignId,
          policyVersion: 1,
          policy: { ...policy, version: 2 },
        },
        founder,
        randomUUID(),
      );
      await executeCampaignCommand(
        db,
        {
          type: "revise",
          requestId: randomUUID(),
          campaignId,
          policyVersion: 2,
          policy: { ...policy, version: 3, accountConnectionId: null },
        },
        founder,
        randomUUID(),
      );
      const rows = await admin<
        { version: number; account: string | null }[]
      >`select version,account_connection_id as account from growth.campaigns where id=${campaignId} order by version`;
      assert.deepEqual(
        [...rows],
        [
          { version: 1, account: accountId },
          { version: 2, account: accountId },
          { version: 3, account: null },
        ],
      );
    } finally {
      if (campaignId) {
        await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where campaign_id=${campaignId})`;
        await admin`delete from growth.outreach_events where campaign_id=${campaignId}`;
        await admin`delete from growth.audit_log where entity_type='campaign' and entity_id=${campaignId}`;
        await admin`delete from growth.campaigns where id=${campaignId}`;
      }
      await admin`delete from growth.campaigns where id in (${directCampaignId},${unboundCampaignId}) or (account_connection_id=${accountId} and name='invalid')`;
      await admin`delete from growth.integration_connections where id in (${accountId},${otherId},${resendId})`;
      await db.end();
      await admin.end();
    }
  },
);
