import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import { postgresNewsletterDispatchRepository } from "./newsletter-dispatch-repository";

function fakeDb(
  handler: (text: string, values: readonly unknown[]) => unknown[],
): GrowthDb {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    return handler(text, values);
  }) as unknown as GrowthDb;
  Object.assign(db, {
    json: (value: unknown) => value,
    __queries: queries,
    begin: async <T>(operation: (tx: GrowthDb) => Promise<T>) => operation(db),
  });
  return db;
}

function queriesOf(
  db: GrowthDb,
): Array<{ text: string; values: readonly unknown[] }> {
  return (
    db as unknown as {
      __queries: Array<{ text: string; values: readonly unknown[] }>;
    }
  ).__queries;
}

const ISSUE_ID = "issue-id";
const NOW = new Date("2026-08-19T09:00:00.000Z");

/** Builds a handler that answers the two reconciliation queries
 * (remaining non-terminal count, then whether any send reached `sent`)
 * with the given values, and records the update queries it observes. */
function reconcileHandler(remainingCount: number, anySent: boolean) {
  return (text: string) => {
    if (text.startsWith("select count(*)::text as count")) {
      return [{ count: String(remainingCount) }];
    }
    if (text.startsWith("select exists(")) {
      return [{ exists: anySent }];
    }
    return [];
  };
}

test("cancelSend reconciles the issue to failed when it was the last send and none reached sent", async () => {
  const db = fakeDb(reconcileHandler(0, false));

  await postgresNewsletterDispatchRepository.cancelSend(db, {
    sendId: "send-id",
    newsletterIssueId: ISSUE_ID,
    errorCode: "suppressed_contact",
  });

  const queries = queriesOf(db);
  assert.match(queries[0]?.text ?? "", /update growth\.newsletter_sends/);
  assert.match(queries[0]?.text ?? "", /status = 'cancelled'/);
  assert.match(queries[1]?.text ?? "", /select count\(\*\)::text as count/);
  assert.match(queries[2]?.text ?? "", /select exists\(/);
  assert.match(queries[3]?.text ?? "", /update growth\.newsletter_issues/);
  assert.match(queries[3]?.text ?? "", /status = 'failed'/);
  assert.match(queries[3]?.text ?? "", /where id = \? and status = 'sending'/);
});

test("cancelSend reconciles the issue to sent when an earlier send already reached sent", async () => {
  const db = fakeDb(reconcileHandler(0, true));

  await postgresNewsletterDispatchRepository.cancelSend(db, {
    sendId: "send-id",
    newsletterIssueId: ISSUE_ID,
    errorCode: "suppressed_contact",
  });

  const queries = queriesOf(db);
  assert.match(queries[3]?.text ?? "", /update growth\.newsletter_issues/);
  assert.match(queries[3]?.text ?? "", /status = 'sent'/);
});

test("cancelSend leaves the issue alone while other sends are still non-terminal", async () => {
  const db = fakeDb(reconcileHandler(1, false));

  await postgresNewsletterDispatchRepository.cancelSend(db, {
    sendId: "send-id",
    newsletterIssueId: ISSUE_ID,
    errorCode: "suppressed_contact",
  });

  const queries = queriesOf(db);
  assert.equal(queries.length, 2);
});

test("failSend reconciles the issue to failed when every send ended failed", async () => {
  const db = fakeDb(reconcileHandler(0, false));

  await postgresNewsletterDispatchRepository.failSend(db, {
    sendId: "send-id",
    newsletterIssueId: ISSUE_ID,
    status: "failed",
    errorCode: "PERMANENT_PROVIDER_ERROR",
    errorSummary: "The Resend provider rejected the request.",
  });

  const queries = queriesOf(db);
  assert.match(queries[3]?.text ?? "", /status = 'failed'/);
});

test("failSend with a retry status does not resolve the issue (retry sends are not terminal)", async () => {
  const db = fakeDb(reconcileHandler(1, false));

  await postgresNewsletterDispatchRepository.failSend(db, {
    sendId: "send-id",
    newsletterIssueId: ISSUE_ID,
    status: "retry",
    errorCode: "RETRYABLE_PROVIDER_ERROR",
    errorSummary: "The Resend provider request failed.",
  });

  const queries = queriesOf(db);
  assert.equal(queries.length, 2);
});

test("recordSent reconciles the issue to sent when it was the last send", async () => {
  const db = fakeDb(reconcileHandler(0, true));

  await postgresNewsletterDispatchRepository.recordSent(db, {
    sendId: "send-id",
    newsletterIssueId: ISSUE_ID,
    providerMessageId: "provider-1",
    sentAt: NOW,
  });

  const queries = queriesOf(db);
  assert.match(queries[0]?.text ?? "", /status = 'sent'/);
  assert.match(queries[3]?.text ?? "", /update growth\.newsletter_issues/);
  assert.match(queries[3]?.text ?? "", /status = 'sent'/);
  assert.deepEqual(queries[3]?.values, [NOW, ISSUE_ID]);
});

test("seedNextDueIssue resolves a just-flipped issue to failed when zero sends were seeded", async () => {
  const db = fakeDb((text) => {
    if (text.startsWith("select id from growth.newsletter_issues")) {
      return [{ id: ISSUE_ID }];
    }
    if (text.startsWith("insert into growth.newsletter_sends")) {
      return [];
    }
    if (text.startsWith("select count(*)::text as count")) {
      return [{ count: "0" }];
    }
    if (text.startsWith("select exists(")) {
      return [{ exists: false }];
    }
    return [];
  });

  const seeded = await postgresNewsletterDispatchRepository.seedNextDueIssue(
    db,
    NOW,
  );

  assert.equal(seeded, true);
  const queries = queriesOf(db);
  assert.match(queries[0]?.text ?? "", /for update skip locked/);
  assert.match(queries[1]?.text ?? "", /status = 'sending'/);
  assert.match(queries[2]?.text ?? "", /insert into growth\.newsletter_sends/);
  assert.match(queries[5]?.text ?? "", /update growth\.newsletter_issues/);
  assert.match(queries[5]?.text ?? "", /status = 'failed'/);
});

test("seedNextDueIssue does not reconcile when sends were seeded", async () => {
  const db = fakeDb((text) => {
    if (text.startsWith("select id from growth.newsletter_issues")) {
      return [{ id: ISSUE_ID }];
    }
    if (text.startsWith("insert into growth.newsletter_sends")) {
      return [{ newsletterIssueId: ISSUE_ID }];
    }
    return [];
  });

  const seeded = await postgresNewsletterDispatchRepository.seedNextDueIssue(
    db,
    NOW,
  );

  assert.equal(seeded, true);
  assert.equal(queriesOf(db).length, 3);
});

test("seedNextDueIssue returns false when nothing is due", async () => {
  const db = fakeDb(() => []);

  const seeded = await postgresNewsletterDispatchRepository.seedNextDueIssue(
    db,
    NOW,
  );

  assert.equal(seeded, false);
  assert.equal(queriesOf(db).length, 1);
});
