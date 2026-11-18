import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { exerciseCampaignReservation } from "./reservation-campaign-assertions";
import { exerciseLegacyReservation } from "./reservation-assertions";
import {
  loadConfiguredAccountReadiness,
  loadReservationAccount,
} from "../../../lib/growth/campaigns/account-repository";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { executeAccountControlCommand } from "../../../lib/growth/campaigns/account-control";
import type { AccountControlCommand } from "../../../lib/growth/campaigns/account-contracts";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "account reviews are atomic, replay-safe and private",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 4,
      connection: { options: "-c role=growth_app" },
    });
    const email = "j.ntagengwa@faithfulsoftware.dev";
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const id = randomUUID();
    const now = Date.now();
    const snapshotMessages = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      transitionId: `200:added:${index}`,
      internalDate: new Date(now - 2000).toISOString(),
      observedUpperBound: new Date(now - 1000).toISOString(),
      recipientCount: 1,
      recipientFingerprint: "a".repeat(64),
    }));
    const readiness = (mode: "prerequisites" | "active") =>
      withGrowthTransaction(db, (tx) =>
        loadConfiguredAccountReadiness(tx, id, mode),
      );
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${email},'connected','test-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      await admin`update growth.integration_connections set google_subject=null where id=${id}`;
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { type: "activate", requestId: randomUUID(), expectedVersion: 1 },
          founder,
          randomUUID(),
        ),
        /account_identity_unknown/,
      );
      await admin`update growth.integration_connections set google_subject='test-subject' where id=${id}`;
      const input = {
        type: "record_limits" as const,
        requestId: randomUUID(),
        expectedVersion: 1,
        evidence: {
          source: "private review",
          edition: "workspace",
          path: "gmail",
          observedAt: new Date(now - 1000),
          expiresAt: new Date(now + 86400000),
          messages: 500,
          recipients: [1000, 1000, 1000, 1000] as [
            number,
            number,
            number,
            number,
          ],
          perMessage: 100,
          messageReserve: 50,
          recipientReserve: 10,
          visibility: {
            source: "private review",
            scope: "mailbox including manual and aliases",
            reviewedAt: new Date(now - 1000),
            expiresAt: new Date(now + 86400000),
            paths: {
              mailbox: "covered" as const,
              aliases: "covered" as const,
              delegates: "covered" as const,
              automatic: "covered" as const,
            },
            recipientHeaders: "complete" as const,
          },
        },
      };
      await assert.rejects(
        executeAccountControlCommand(
          db,
          input,
          { ...founder, actorId: "bad" },
          randomUUID(),
        ),
        /founder_authorization_required/,
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { ...input, evidence: { ...input.evidence, messageReserve: 49 } },
          founder,
          randomUUID(),
        ),
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          {
            ...input,
            evidence: {
              ...input.evidence,
              expiresAt: new Date(now + 31 * 86400000),
            },
          },
          founder,
          randomUUID(),
        ),
        /invalid_limits_time/,
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          {
            ...input,
            evidence: {
              ...input.evidence,
              visibility: {
                ...input.evidence.visibility,
                reviewedAt: new Date(now + 60000),
              },
            },
          },
          founder,
          randomUUID(),
        ),
        /invalid_visibility_time/,
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          {
            ...input,
            evidence: {
              ...input.evidence,
              visibility: {
                ...input.evidence.visibility,
                expiresAt: new Date(now + 2 * 86400000),
              },
            },
          },
          founder,
          randomUUID(),
        ),
        /invalid_visibility_time/,
      );
      const [first, replay] = await Promise.all([
        executeAccountControlCommand(db, input, founder, randomUUID()),
        executeAccountControlCommand(db, input, founder, randomUUID()),
      ]);
      assert.equal(first.reviewId, replay.reviewId);
      const [binding] =
        await admin`select evidence from growth.outreach_account_reviews where id=${first.reviewId}`;
      assert.equal(binding?.evidence.googleSubject, "test-subject");
      assert.deepEqual(binding?.evidence.googleScopes, [
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
        "openid",
      ]);
      await admin`update growth.outreach_account_reviews set evidence=evidence - 'googleSubject' where id=${first.reviewId}`;
      assert.deepEqual(await readiness("prerequisites"), {
        status: "held",
        reason: "visibility_unknown",
      });
      await admin`update growth.outreach_account_reviews set evidence=${admin.json(binding!.evidence)} where id=${first.reviewId}`;
      await admin`update growth.outreach_account_reviews set evidence=jsonb_set(evidence,'{evidence,visibility,paths,aliases}',to_jsonb('unknown'::text)) where id=${first.reviewId}`;
      assert.deepEqual(await readiness("prerequisites"), {
        status: "held",
        reason: "visibility_unknown",
      });
      await admin`update growth.outreach_account_reviews set evidence=${admin.json(binding!.evidence)} where id=${first.reviewId}`;
      assert.equal(first.version, 2);
      const other = randomUUID();
      try {
        await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject) values (${other},'gmail',${`${other}@example.test`},'connected','other-subject')`;
        await admin`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${other},'other-subject',1,'{}')`;
        await assert.rejects(
          db`update growth.outreach_account_controls set limits_review_id=${first.reviewId} where connection_id=${other}`,
        );
        assert.equal(
          (
            await withGrowthTransaction(db, (tx) =>
              loadConfiguredAccountReadiness(tx, other, "prerequisites"),
            )
          ).status,
          "held",
        );
        await assert.rejects(
          db`insert into growth.outreach_account_controls(connection_id,provider,verified_subject,verified_grant_epoch,verified_scopes) values (${randomUUID()},'resend','bad',1,'{}')`,
        );
      } finally {
        await admin`delete from growth.outreach_account_controls where connection_id=${other}`;
        await admin`delete from growth.integration_connections where id=${other}`;
      }

      await assert.rejects(
        executeAccountControlCommand(
          db,
          { ...input, evidence: { ...input.evidence, messages: 501 } },
          founder,
          randomUUID(),
        ),
        /request_conflict/,
      );
      await assert.rejects(
        db`update growth.outreach_account_reviews set evidence='{}' where id=${first.reviewId}`,
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { type: "activate", requestId: randomUUID(), expectedVersion: 2 },
          founder,
          randomUUID(),
        ),
        /health_unknown/,
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          {
            type: "record_health",
            requestId: randomUUID(),
            expectedVersion: 2,
            evidence: {
              source: "log",
              observedFrom: new Date(now - 2000),
              observedUntil: new Date(now - 1000),
              expiresAt: new Date(now + 1000),
              complete: true,
              verdict: "healthy",
              sends: 1,
              attempts: 1,
              hardBounces: 2,
              complaints: 0,
              rateIncidents: 0,
              authIncidents: 0,
              authentication: {
                spf: { status: "pass", source: "SPF record" },
                dkim: { status: "pass", source: "DKIM test" },
                dmarc: { status: "pass", source: "DMARC record" },
              },
            },
          },
          founder,
          randomUUID(),
        ),
        /inconsistent_health_counts/,
      );
      const health: Extract<AccountControlCommand, { type: "record_health" }> =
        {
          type: "record_health" as const,
          requestId: randomUUID(),
          expectedVersion: 2,
          evidence: {
            source: "private health log",
            observedFrom: new Date(now - 3600000),
            observedUntil: new Date(now - 1000),
            expiresAt: new Date(now + 3600000),
            complete: true,
            verdict: "healthy" as const,
            sends: 5,
            attempts: 5,
            hardBounces: 0,
            complaints: 0,
            rateIncidents: 0,
            authIncidents: 0,
            authentication: {
              spf: { status: "pass", source: "SPF record" },
              dkim: { status: "pass", source: "DKIM test" },
              dmarc: { status: "pass", source: "DMARC record" },
            },
          },
        };
      await executeAccountControlCommand(db, health, founder, randomUUID());
      const [visibility] =
        await admin`select has_table_privilege('anon','growth.outreach_account_reviews','select') as anon_read, has_table_privilege('authenticated','growth.outreach_account_reviews','select') as authenticated_read, has_table_privilege('growth_app','growth.outreach_account_reviews','update') as growth_update`;
      assert.deepEqual(
        [
          visibility?.anon_read,
          visibility?.authenticated_read,
          visibility?.growth_update,
        ],
        [false, false, false],
      );
      await admin`insert into growth.outreach_provider_usage(account_id,observed_at,rolling_messages,rolling_recipients,message_limit,recipient_limit,complete,health) values (${id},now(),0,0,500,1000,true,'healthy')`;
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { type: "activate", requestId: randomUUID(), expectedVersion: 3 },
          founder,
          randomUUID(),
        ),
        /usage_unknown/,
      );
      await admin`delete from growth.outreach_provider_usage where account_id=${id}`;
      const legacyMessages = snapshotMessages.map((message) => ({
        id: message.id,
        sentAt: message.observedUpperBound,
        recipientCount: message.recipientCount,
      }));
      await admin`insert into growth.outreach_provider_usage(account_id,observed_at,rolling_messages,rolling_recipients,complete,health,connection_id,grant_epoch,captured_at,window_start,history_start,history_end,fresh_until,evidence_version,provider_message_ids) values (${id},now(),10,10,true,'healthy',${id},1,now(),now() - interval '24 hours','100','200',now() + interval '4 minutes',1,${admin.json(legacyMessages)})`;
      assert.deepEqual(await readiness("prerequisites"), {
        status: "held",
        reason: "usage_unknown",
      });
      await admin`update growth.outreach_provider_usage set evidence_version=2,provider_message_ids=${admin.json(snapshotMessages)} where account_id=${id}`;
      assert.deepEqual(await readiness("prerequisites"), {
        status: "held",
        reason: "usage_unknown",
      });
      await admin`update growth.outreach_provider_usage set observation_subject='test-subject',observation_scopes=${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]},observation_revision=1 where account_id=${id}`;
      assert.equal((await readiness("prerequisites")).status, "ready");
      assert.equal((await readiness("active")).status, "held");
      await executeAccountControlCommand(
        db,
        { type: "activate", requestId: randomUUID(), expectedVersion: 3 },
        founder,
        randomUUID(),
      );
      await admin`update growth.outreach_account_controls set last_ramp_at=now() - interval '2 hours' where connection_id=${id}`;
      const nextHealth = {
        ...health,
        requestId: randomUUID(),
        expectedVersion: 4,
      };
      await executeAccountControlCommand(db, nextHealth, founder, randomUUID());
      const ramp = {
        type: "approve_ramp" as const,
        requestId: randomUUID(),
        expectedVersion: 5,
        ramp: 50 as const,
      };
      const results = await Promise.allSettled([
        executeAccountControlCommand(db, ramp, founder, randomUUID()),
        executeAccountControlCommand(
          db,
          { ...ramp, requestId: randomUUID() },
          founder,
          randomUUID(),
        ),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      await assert.rejects(
        executeAccountControlCommand(
          db,
          {
            type: "approve_ramp",
            requestId: randomUUID(),
            expectedVersion: 6,
            ramp: 100,
          },
          founder,
          randomUUID(),
        ),
        /health_review_reused/,
      );
      await admin`create function growth.test_reject_account_audit() returns trigger language plpgsql as $$ begin if new.correlation_id = 'test-account-audit-failure' then raise exception 'test audit failure'; end if; return new; end $$`;
      await admin`create trigger test_reject_account_audit before insert on growth.audit_log for each row execute function growth.test_reject_account_audit()`;
      try {
        await assert.rejects(
          executeAccountControlCommand(
            db,
            {
              type: "halt",
              requestId: randomUUID(),
              expectedVersion: 6,
              reason: "test",
            },
            founder,
            "test-account-audit-failure",
          ),
          /test audit failure/,
        );
        const [unchanged] =
          await admin`select version from growth.outreach_account_controls where connection_id=${id}`;
        assert.equal(unchanged?.version, 6);
      } finally {
        await admin`drop trigger test_reject_account_audit on growth.audit_log`;
        await admin`drop function growth.test_reject_account_audit()`;
      }
      await executeAccountControlCommand(
        db,
        { type: "activate", requestId: randomUUID(), expectedVersion: 6 },
        founder,
        randomUUID(),
      );
      assert.equal((await readiness("active")).status, "ready");
      const accountForReservation = await withGrowthTransaction(db, (tx) =>
        loadReservationAccount(tx, id),
      );
      assert.equal(accountForReservation.status, "ready");
      if (accountForReservation.status === "ready")
        assert.deepEqual(accountForReservation.account.usage.providerIds, []);
      await exerciseCampaignReservation(admin, db, { id, email, now, founder });
      await exerciseLegacyReservation(admin, db, { id, email });
      await assert.rejects(
        admin`insert into growth.outreach_provider_usage(account_id,complete,health,connection_id) values (${randomUUID()},false,'unknown',${id})`,
      );
      const duplicateMessages = [...snapshotMessages];
      duplicateMessages[1] = duplicateMessages[0]!;
      await admin`update growth.outreach_provider_usage set provider_message_ids=${admin.json(duplicateMessages)} where account_id=${id}`;
      assert.equal((await readiness("active")).status, "held");
      await admin`update growth.outreach_provider_usage set provider_message_ids=${admin.json(snapshotMessages)} where account_id=${id}`;
      await admin`update growth.outreach_provider_usage set rolling_recipients=0 where account_id=${id}`;
      assert.equal((await readiness("active")).status, "held");
      await admin`update growth.outreach_provider_usage set rolling_recipients=10 where account_id=${id}`;
      await admin`update growth.integration_connections set version=version+1,granted_scopes=array_replace(granted_scopes,'email','https://www.googleapis.com/auth/userinfo.email') where id=${id}`;
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { type: "activate", requestId: randomUUID(), expectedVersion: 7 },
          founder,
          randomUUID(),
        ),
        /usage_unknown/,
      );
      assert.equal((await readiness("active")).status, "held");
      await admin`update growth.outreach_provider_usage set grant_epoch=2 where account_id=${id}`;
      assert.equal((await readiness("active")).status, "ready");
      const [stillActive] =
        await admin`select state from growth.outreach_account_controls where connection_id=${id}`;
      assert.equal(stillActive?.state, "active");
      await admin`update growth.integration_connections set version=version+1,granted_scopes=array_append(granted_scopes,'new-scope') where id=${id}`;
      const revalidate = {
        type: "revalidate_grant" as const,
        requestId: randomUUID(),
        expectedVersion: 7,
        expectedGrantVersion: 3,
      };
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { ...revalidate, expectedGrantVersion: 1 },
          founder,
          randomUUID(),
        ),
        /grant_version_changed/,
      );
      await admin`update growth.integration_connections set google_subject='other-subject' where id=${id}`;
      await assert.rejects(
        executeAccountControlCommand(db, revalidate, founder, randomUUID()),
        /account_authority_changed/,
      );
      await admin`update growth.integration_connections set google_subject='test-subject' where id=${id}`;
      assert.equal((await readiness("active")).status, "held");
      const revalidated = await executeAccountControlCommand(
        db,
        revalidate,
        founder,
        randomUUID(),
      );
      assert.equal(revalidated.version, 8);
      const [after] =
        await admin`select state,ramp,limits_review_id from growth.outreach_account_controls where connection_id=${id}`;
      const [invalidated] =
        await admin`select complete,incomplete_reason from growth.outreach_provider_usage where account_id=${id}`;
      assert.equal(invalidated?.complete, false);
      assert.equal(invalidated?.incomplete_reason, "grant_revalidated");
      assert.equal(after?.state, "paused");
      assert.equal(after?.limits_review_id, null);
      assert.equal((await readiness("active")).status, "held");
      assert.equal(after?.ramp, 50);
      await assert.rejects(
        executeAccountControlCommand(
          db,
          { type: "activate", requestId: randomUUID(), expectedVersion: 8 },
          founder,
          randomUUID(),
        ),
        /visibility_unknown/,
      );
      await admin`update growth.integration_connections set status='revoked',version=version+1 where id=${id}`;
      await executeAccountControlCommand(
        db,
        {
          type: "halt",
          requestId: randomUUID(),
          expectedVersion: 8,
          reason: "grant revoked",
        },
        founder,
        randomUUID(),
      );
      const [count] =
        await admin`select count(*)::int as value from growth.outreach_account_reviews where connection_id=${id}`;
      assert.equal(count?.value, 8);
    } finally {
      await admin`delete from growth.outreach_provider_usage where account_id=${id}`;
      await admin`update growth.outreach_account_controls set limits_review_id=null,health_review_id=null where connection_id=${id}`;
      await admin`delete from growth.outreach_account_reviews where connection_id=${id}`;
      await admin`delete from growth.outreach_account_controls where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);
