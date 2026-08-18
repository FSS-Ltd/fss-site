import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { postgresSequenceStopRepository } from "./stop-repository";

function fakeTransaction(
  handler: (text: string, values: readonly unknown[]) => unknown[],
): GrowthDb {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    return handler(text, values);
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, {
    json: (value: unknown) => value,
    __queries: queries,
  });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
    __queries: queries,
  } as unknown as GrowthDb;
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

test("locks the enrollment, cancels pending messages, applies the stop, and audits atomically", async () => {
  const db = fakeTransaction((text) => {
    if (text.startsWith("select se.id")) {
      return [
        {
          id: "sequence-id",
          status: "active",
          normalisedEmail: "contact@example.test",
          businessId: "business-id",
        },
      ];
    }
    if (text.startsWith("update growth.email_messages")) {
      return [{ id: "message-id-1" }, { id: "message-id-2" }];
    }
    return [];
  });

  const result = await postgresSequenceStopRepository.withTransaction(
    db,
    async (tx) => {
      const enrollment = await tx.lockEnrollment("sequence-id");
      const cancelled = await tx.cancelPendingMessages("sequence-id");
      await tx.applyStop({
        sequenceId: "sequence-id",
        status: "stopped_reply",
        reason: "reply",
        stoppedAt: new Date("2026-08-18T09:00:00.000Z"),
      });
      await tx.appendStopAudit({
        correlationId: "correlation-id",
        actorType: "cron",
        actorId: "gmail-sync",
        sequenceId: "sequence-id",
        reason: "reply",
      });
      return { enrollment, cancelled };
    },
  );

  assert.equal(result.enrollment?.id, "sequence-id");
  assert.equal(result.cancelled.cancelledCount, 2);

  const queries = queriesOf(db);
  assert.match(queries[0]?.text ?? "", /for update of se$/);
  assert.match(queries[1]?.text ?? "", /status in \('queued', 'retry'\)/);
  assert.match(queries[2]?.text ?? "", /update growth\.sequence_enrollments/);
  assert.deepEqual(queries[2]?.values, [
    "stopped_reply",
    new Date("2026-08-18T09:00:00.000Z"),
    "reply",
    "sequence-id",
  ]);
  assert.match(queries[3]?.text ?? "", /insert into growth\.audit_log/);
  assert.deepEqual(queries[3]?.values.slice(0, 6), [
    "correlation-id",
    "cron",
    "gmail-sync",
    "sequence.stopped.reply",
    "sequence_enrollment",
    "sequence-id",
  ]);
});

test("returns null when the enrollment does not exist", async () => {
  const db = fakeTransaction(() => []);

  const enrollment = await postgresSequenceStopRepository.withTransaction(
    db,
    (tx) => tx.lockEnrollment("missing"),
  );

  assert.equal(enrollment, null);
});

test("inserts a suppression only once per email on conflict", async () => {
  const db = fakeTransaction(() => []);

  await postgresSequenceStopRepository.withTransaction(db, (tx) =>
    tx.insertDoNotContactSuppression({
      normalisedEmail: "contact@example.test",
      businessId: "business-id",
      reason: "do_not_contact",
      source: "founder",
      createdBy: "founder-actor",
    }),
  );

  const query = queriesOf(db)[0]!;
  assert.match(query.text, /insert into growth\.suppressions/);
  assert.match(query.text, /on conflict \(normalised_email\) do nothing/);
});
