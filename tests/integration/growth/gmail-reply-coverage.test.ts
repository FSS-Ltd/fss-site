import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { GmailClientError } from "../../../lib/growth/integrations/gmail/types";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "reply coverage stores private, gap-aware, replay-safe intervals",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const id = randomUUID();
    let exists = false;
    try {
      const [table] =
        await admin`select to_regclass('growth.gmail_reply_coverage')::text as name`;
      exists = table?.name === "growth.gmail_reply_coverage";
      assert.equal(exists, true, "reply coverage table exists");
      await admin`insert into growth.integration_connections(id,provider,subject_email,status) values (${id},'gmail',${`${id}@example.test`},'connected')`;
      const baseline = new Date("2026-11-17T12:00:00Z");
      await db`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason) values (${id},1,'subject',null,'100',null,${baseline},${baseline},${baseline},'gap','initial_history_unknown')`;
      await assert.rejects(
        db`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason) values (${id},1,'subject',null,'100',null,${baseline},${baseline},${baseline},'gap','initial_history_unknown')`,
      );
      await assert.rejects(
        db`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason) values (${id},1,'subject','100','101',null,${baseline},${baseline},${baseline},'complete',null)`,
      );
      await assert.rejects(
        db`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason,unknown_observations) values (${id},1,'subject','100','101',${baseline},${new Date("2026-11-18T12:00:00Z")},${new Date("2026-11-18T12:00:00Z")},${new Date("2026-11-18T12:00:00Z")},'complete',null,${db.json([{ messageId: "m", reason: "message_deleted" }])})`,
      );
      await assert.rejects(
        db`update growth.gmail_reply_coverage set reason='rewritten' where connection_id=${id}`,
      );
      const [privileges] =
        await admin`select has_table_privilege('anon','growth.gmail_reply_coverage','select') as anon_read, has_table_privilege('growth_app','growth.gmail_reply_coverage','update') as growth_update`;
      assert.equal(privileges?.anon_read, false);
      assert.equal(privileges?.growth_update, false);
    } finally {
      if (exists)
        await admin`delete from growth.gmail_reply_coverage where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "commits coverage only for the credential's current grant and cursor",
  { skip: !url },
  async () => {
    if (!url) return;
    const { commitReplyCoverage, loadReplySyncState, loadReplyCoverage } =
      await import("../../../lib/growth/sequences/gmail-sync-repository");
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const id = randomUUID();
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
    const baseline = {
      binding,
      expectedCursor: null,
      expectedObservedUntil: null,
      expectedCoverageId: null,
      historyStart: null,
      historyEnd: "100",
      observedFrom: null,
      observedUntil: new Date("2026-11-17T12:00:00Z"),
      headRequestedAt: new Date("2026-11-17T11:59:59Z"),
      headRespondedAt: new Date("2026-11-17T12:00:00Z"),
      state: "gap" as const,
      reason: "initial_history_unknown",
      unknownObservations: [{ messageId: "m1", reason: "message_deleted" }],
    };
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${`${id}@example.test`},'connected','subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      const baselineId = await commitReplyCoverage(db, baseline);
      assert.equal(await commitReplyCoverage(db, baseline), baselineId);
      assert.deepEqual(await loadReplySyncState(db, binding), {
        cursor: "100",
        historyCursor: "100",
        coverageId: baselineId,
        observedUntil: baseline.observedUntil,
      });
      assert.equal(
        await loadReplyCoverage(
          db,
          id,
          "subject",
          new Date("2026-11-16T12:00:00Z"),
          baseline.observedUntil,
        ),
        false,
      );
      const later = {
        binding,
        expectedCursor: "100",
        expectedObservedUntil: baseline.observedUntil,
        expectedCoverageId: baselineId,
        historyStart: "100",
        historyEnd: "100",
        observedFrom: baseline.observedUntil,
        observedUntil: new Date("2026-11-18T12:00:00Z"),
        headRequestedAt: new Date("2026-11-18T12:00:00Z"),
        headRespondedAt: new Date("2026-11-18T12:00:01Z"),
        state: "complete" as const,
        reason: null,
        unknownObservations: [],
      };
      await assert.rejects(
        commitReplyCoverage(db, { ...later, historyEnd: "99" }),
        /history/i,
      );
      const laterId = await commitReplyCoverage(db, later);
      assert.equal(await commitReplyCoverage(db, later), laterId);
      const next = {
        ...later,
        expectedObservedUntil: later.observedUntil,
        expectedCoverageId: laterId,
        observedFrom: later.observedUntil,
        observedUntil: new Date("2026-11-19T12:00:00Z"),
        headRequestedAt: new Date("2026-11-19T12:00:00Z"),
        headRespondedAt: new Date("2026-11-19T12:00:01Z"),
      };
      const concurrent = await Promise.allSettled([
        commitReplyCoverage(db, next),
        commitReplyCoverage(db, {
          ...next,
          observedUntil: new Date("2026-11-19T13:00:00Z"),
        }),
      ]);
      assert.equal(
        concurrent.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        concurrent.filter((result) => result.status === "rejected").length,
        1,
      );
      await assert.rejects(
        commitReplyCoverage(db, {
          ...later,
          observedUntil: new Date("2026-11-18T13:00:00Z"),
        }),
        /conflict/i,
      );
      const [rows] =
        await admin`select count(*)::int as count from growth.gmail_reply_coverage where connection_id=${id}`;
      assert.equal(rows?.count, 3);
      await assert.rejects(
        commitReplyCoverage(db, {
          ...baseline,
          binding: { ...binding, grantEpoch: 2 },
        }),
        /grant/i,
      );
      await assert.rejects(
        commitReplyCoverage(db, {
          ...baseline,
          observedUntil: new Date("2026-11-17T13:00:00Z"),
        }),
        /conflict/i,
      );
      const [connection] =
        await admin`select provider_cursor from growth.integration_connections where id=${id}`;
      assert.equal(connection?.provider_cursor, "100");
    } finally {
      await admin`delete from growth.gmail_reply_coverage where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "sync records an honest baseline and later continuous coverage on the bound account",
  { skip: !url },
  async () => {
    if (!url) return;
    const { createGmailReplySync } =
      await import("../../../lib/growth/sequences/gmail-sync");
    const { postgresGmailSyncRepository, loadReplyCoverage } =
      await import("../../../lib/growth/sequences/gmail-sync-repository");
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
    const times = [
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-17T12:00:00Z",
      "2026-11-17T12:00:01Z",
    ].map((value) => new Date(value));
    try {
      await admin`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${id},'gmail',${email},'connected','subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        binding,
        founderEmail: email,
        now: () => times.shift()!,
        gmailClient: {
          getProfile: async () => ({ emailAddress: email, historyId: "100" }),
          listHistory: async () => ({ historyId: "100", records: [] }),
          getMessageMetadata: async () => {
            throw new Error("unexpected metadata");
          },
        },
      });
      await sync(db);
      await sync(db);
      assert.equal(
        await loadReplyCoverage(
          db,
          id,
          "subject",
          new Date("2026-11-16T12:00:00Z"),
          new Date("2026-11-17T12:00:00Z"),
        ),
        true,
      );
      assert.equal(
        await loadReplyCoverage(
          db,
          id,
          "other",
          new Date("2026-11-16T12:00:00Z"),
          new Date("2026-11-17T12:00:00Z"),
        ),
        false,
      );
      await admin`update growth.integration_connections set provider_cursor=null,version=2 where id=${id}`;
      const expiredTimes = [
        new Date("2026-11-18T12:00:00Z"),
        new Date("2026-11-18T12:00:01Z"),
      ];
      const expired = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        binding: { ...binding, grantEpoch: 2 },
        founderEmail: email,
        now: () => {
          const value = expiredTimes.shift();
          assert.ok(value);
          return value;
        },
        gmailClient: {
          getProfile: async () => ({ emailAddress: email, historyId: "200" }),
          listHistory: async () => {
            throw new GmailClientError("HISTORY_ID_EXPIRED");
          },
          getMessageMetadata: async () => {
            throw new Error("unexpected metadata");
          },
        },
      });
      assert.equal((await expired(db)).cursorReset, true);
      const [gap] =
        await admin`select state,reason,history_start,history_end from growth.gmail_reply_coverage where connection_id=${id} and grant_epoch=2`;
      assert.equal(gap?.state, "gap");
      assert.equal(gap?.reason, "history_expired");
      assert.equal(gap?.history_start, "100");
      assert.equal(gap?.history_end, "200");
      await admin`update growth.integration_connections set provider_cursor=null,version=3,google_subject='different' where id=${id}`;
      const newSubjectTimes = [
        new Date("2026-11-19T12:00:00Z"),
        new Date("2026-11-19T12:00:01Z"),
      ];
      const newSubject = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        binding: { ...binding, googleSubject: "different", grantEpoch: 3 },
        founderEmail: email,
        now: () => {
          const value = newSubjectTimes.shift();
          assert.ok(value);
          return value;
        },
        gmailClient: {
          getProfile: async () => ({ emailAddress: email, historyId: "300" }),
          listHistory: async () => {
            throw new Error("must not recover another subject");
          },
          getMessageMetadata: async () => {
            throw new Error("unexpected metadata");
          },
        },
      });
      await newSubject(db);
      const [crossed] =
        await admin`select history_start,reason from growth.gmail_reply_coverage where connection_id=${id} and grant_epoch=3`;
      assert.equal(crossed?.history_start, null);
      assert.equal(crossed?.reason, "initial_history_unknown");
    } finally {
      await admin`delete from growth.gmail_reply_coverage where connection_id=${id}`;
      await admin`delete from growth.integration_connections where id=${id}`;
      await db.end();
      await admin.end();
    }
  },
);
