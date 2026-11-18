import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "usage snapshots are grant bound, replay fenced, and never publish a held zero",
  { skip: !url },
  async () => {
    if (!url) return;
    const { commitGmailUsage, startGmailUsageObservation } =
      await import("../../../lib/growth/campaigns/usage-repository");
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const id = randomUUID();
    const email = `${id}@example.test`;
    const binding = {
      connectionId: id,
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    };
    const capturedAt = new Date(Date.now() - 1000);
    const state = {
      binding,
      baselineAt: capturedAt,
      historyStart: "100",
      historyEnd: "100",
      capturedAt,
      observations: [
        {
          id: "m1",
          transitionId: "101:m1",
          internalDate: new Date(capturedAt.getTime() - 2000).toISOString(),
          observedUpperBound: new Date(
            capturedAt.getTime() - 1000,
          ).toISOString(),
          recipientCount: 2,
          recipientFingerprint: "a".repeat(64),
        },
      ],
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${email},'connected','subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      const started = await startGmailUsageObservation(db, binding, email);
      assert.equal(started.revision, 1);
      await commitGmailUsage(db, {
        binding,
        subjectEmail: email,
        expectedRevision: started.revision,
        result: { status: "held", reason: "baseline_unmatured", state },
      });
      const [held] =
        await admin`select complete,rolling_messages,rolling_recipients,observation_revision from growth.outreach_provider_usage where connection_id=${id}`;
      assert.equal(held?.complete, false);
      assert.equal(held?.rolling_messages, null);
      assert.equal(held?.rolling_recipients, null);
      assert.equal(held?.observation_revision, 2);
      await assert.rejects(
        commitGmailUsage(db, {
          binding,
          subjectEmail: email,
          expectedRevision: null,
          result: { status: "held", reason: "baseline_unmatured", state },
        }),
        /conflict/i,
      );
      await assert.rejects(
        commitGmailUsage(db, {
          binding,
          subjectEmail: email,
          expectedRevision: 2,
          result: {
            status: "held",
            reason: "history_incomplete",
            state: { ...state, observations: [] },
          },
        }),
        /prior usage evidence missing/i,
      );
      await assert.rejects(
        commitGmailUsage(db, {
          binding: { ...binding, grantEpoch: 2 },
          subjectEmail: email,
          expectedRevision: 2,
          result: { status: "held", reason: "baseline_unmatured", state },
        }),
        /grant/i,
      );
      const outcome = await commitGmailUsage(db, {
        binding,
        subjectEmail: email,
        expectedRevision: 2,
        result: {
          status: "complete",
          state: {
            ...state,
            baselineAt: new Date(capturedAt.getTime() - 86400000),
          },
        },
      });
      assert.deepEqual(outcome, {
        status: "held",
        reason: "visibility_unknown",
      });
    } finally {
      await admin`delete from growth.outreach_provider_usage where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "a failed provider observation leaves prior usage unavailable",
  { skip: !url },
  async () => {
    if (!url) return;
    const { refreshGmailUsage } =
      await import("../../../lib/growth/integrations/gmail/usage-service");
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const id = randomUUID();
    const email = `${id}@example.test`;
    const binding = {
      connectionId: id,
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${email},'connected','subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      const result = await refreshGmailUsage(db, {
        binding,
        subjectEmail: email,
        client: {
          getProfile: async () => {
            throw new Error("private provider detail");
          },
          listHistory: async () => ({ historyId: "1", records: [] }),
          listSentMessages: async () => ({ messages: [] }),
          getMessageMetadata: async () => {
            throw new Error("unexpected metadata");
          },
        },
      });
      assert.deepEqual(result, {
        status: "held",
        reason: "provider_incomplete",
      });
      const [row] =
        await admin`select complete,rolling_messages,rolling_recipients from growth.outreach_provider_usage where connection_id=${id}`;
      assert.equal(row?.complete, false);
      assert.equal(row?.rolling_messages, null);
      assert.equal(row?.rolling_recipients, null);
    } finally {
      await admin`delete from growth.outreach_provider_usage where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "bound observer persists a mature forward interval and holds on grant change",
  { skip: !url },
  async () => {
    if (!url) return;
    const { refreshGmailUsage } =
      await import("../../../lib/growth/integrations/gmail/usage-service");
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const id = randomUUID(),
      reviewId = randomUUID(),
      email = `${id}@example.test`;
    const binding = {
      connectionId: id,
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    };
    const now = Date.now();
    const review = {
      evidence: {
        source: "review",
        edition: "workspace",
        path: "gmail",
        observedAt: new Date(now - 1000).toISOString(),
        expiresAt: new Date(now + 86400000).toISOString(),
        messages: 1000,
        recipients: [1000, 1000, 1000, 1000],
        perMessage: 100,
        messageReserve: 50,
        recipientReserve: 10,
        visibility: {
          source: "review",
          scope: "all paths",
          reviewedAt: new Date(now - 1000).toISOString(),
          expiresAt: new Date(now + 86400000).toISOString(),
          paths: {
            mailbox: "covered",
            aliases: "covered",
            delegates: "covered",
            automatic: "covered",
          },
          recipientHeaders: "complete",
        },
      },
      googleSubject: "subject",
      googleScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    };
    const client = {
      getProfile: async () => ({ emailAddress: email, historyId: "100" }),
      listHistory: async () => ({ historyId: "100", records: [] }),
      listSentMessages: async () => ({ messages: [] }),
      getMessageMetadata: async () => {
        throw new Error("unexpected metadata");
      },
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${email},'connected','subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      await admin`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${id},'subject',1,${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      await admin`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${reviewId},${id},${randomUUID()},${"a".repeat(64)},${"b".repeat(64)},'record_limits',${admin.json(review)},2)`;
      await admin`update growth.outreach_account_controls set limits_review_id=${reviewId} where connection_id=${id}`;
      const old = new Date(now - 25 * 60 * 60 * 1000);
      assert.equal(
        (
          await refreshGmailUsage(db, {
            binding,
            subjectEmail: email,
            client,
            now: () => old,
          })
        ).status,
        "held",
      );
      assert.deepEqual(
        await refreshGmailUsage(db, {
          binding,
          subjectEmail: email,
          client,
          now: () => new Date(Date.now() - 1000),
        }),
        { status: "complete" },
      );
      const [complete] =
        await admin`select complete,rolling_messages,rolling_recipients from growth.outreach_provider_usage where connection_id=${id}`;
      assert.equal(complete?.complete, true);
      assert.equal(complete?.rolling_messages, 0);
      assert.equal(complete?.rolling_recipients, 0);
      const changedClient = {
        ...client,
        getProfile: async () => {
          await admin`update growth.integration_connections set version=version+1 where id=${id}`;
          return { emailAddress: email, historyId: "100" };
        },
      };
      await assert.rejects(
        refreshGmailUsage(db, {
          binding,
          subjectEmail: email,
          client: changedClient,
        }),
        /grant changed/i,
      );
      const [held] =
        await admin`select complete from growth.outreach_provider_usage where connection_id=${id}`;
      assert.equal(held?.complete, false);
    } finally {
      await admin`delete from growth.outreach_provider_usage where connection_id=${id}`;
      await admin`update growth.outreach_account_controls set limits_review_id=null where connection_id=${id}`;
      await admin`delete from growth.outreach_account_reviews where connection_id=${id}`;
      await admin`delete from growth.outreach_account_controls where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "conflicting legacy and bound usage rows hold instead of choosing one",
  { skip: !url },
  async () => {
    if (!url) return;
    const { startGmailUsageObservation } =
      await import("../../../lib/growth/campaigns/usage-repository");
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const id = randomUUID(),
      other = randomUUID(),
      email = `${id}@example.test`;
    const binding = {
      connectionId: id,
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${email},'connected','subject',${binding.grantedScopes})`;
      await admin`insert into growth.outreach_provider_usage(account_id,complete,health) values (${id},false,'unknown')`;
      await admin`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${other},${id},false,'unknown')`;
      await assert.rejects(
        startGmailUsageObservation(db, binding, email),
        /conflict/i,
      );
    } finally {
      await admin`delete from growth.outreach_provider_usage where account_id in (${id},${other})`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);
