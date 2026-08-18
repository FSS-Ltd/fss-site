import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import { postgresSequenceDispatchRepository } from "./dispatcher-repository";

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

test("claims one due message with FOR UPDATE SKIP LOCKED and increments its attempt count", async () => {
  const db = fakeDb((text) => {
    if (text.startsWith("with target")) {
      return [
        {
          id: "message-id",
          previousStatus: "queued",
          sequenceEnrollmentId: "enrollment-id",
          prospectId: "prospect-id",
          contactId: "contact-id",
          stepNumber: 0,
          attemptCount: 1,
          rfcMessageId: null,
          idempotencyKey: "first_email:draft-id",
          subjectSnapshot: "Subject",
          htmlSnapshot: "<p>Body</p>",
          textSnapshot: "Body",
        },
      ];
    }
    return [];
  });

  const claimed = await postgresSequenceDispatchRepository.claimDueMessage(db, {
    now: new Date("2026-08-18T09:00:00.000Z"),
    leaseToken: "lease-token",
    leaseExpiresAt: new Date("2026-08-18T09:05:00.000Z"),
  });

  assert.equal(claimed?.id, "message-id");
  const query = queriesOf(db)[0]!;
  assert.match(query.text, /for update of em skip locked/);
  assert.match(query.text, /status in \('queued', 'retry'\)/);
  assert.match(query.text, /lease_expires_at < \?/);
  assert.match(query.text, /attempt_count = em\.attempt_count \+ 1/);
});

test("returns null when nothing is due", async () => {
  const db = fakeDb(() => []);

  const claimed = await postgresSequenceDispatchRepository.claimDueMessage(db, {
    now: new Date(),
    leaseToken: "lease-token",
    leaseExpiresAt: new Date(),
  });

  assert.equal(claimed, null);
});

test("cancels a message and clears its lease", async () => {
  const db = fakeDb(() => []);

  await postgresSequenceDispatchRepository.cancelMessage(db, {
    messageId: "message-id",
    errorCode: "suppressed_contact",
  });

  const query = queriesOf(db)[0]!;
  assert.match(query.text, /status = 'cancelled'/);
  assert.match(query.text, /lease_token = null/);
  assert.deepEqual(query.values, ["suppressed_contact", "message-id"]);
});

test("fails a message with the given status and reason", async () => {
  const db = fakeDb(() => []);

  await postgresSequenceDispatchRepository.failMessage(db, {
    messageId: "message-id",
    status: "retry",
    errorCode: "RETRYABLE_PROVIDER_ERROR",
    errorSummary: "The Gmail provider request failed.",
  });

  const query = queriesOf(db)[0]!;
  assert.deepEqual(query.values, [
    "retry",
    "RETRYABLE_PROVIDER_ERROR",
    "The Gmail provider request failed.",
    "message-id",
  ]);
});

test("records a sent message and inserts its follow-ups atomically", async () => {
  const db = fakeDb(() => []);

  await postgresSequenceDispatchRepository.recordSent(db, {
    messageId: "message-id",
    sequenceEnrollmentId: "enrollment-id",
    prospectId: "prospect-id",
    contactId: "contact-id",
    providerMessageId: "provider-message-1",
    providerThreadId: "provider-thread-1",
    sentAt: new Date("2026-08-18T09:00:00.000Z"),
    rfcMessageId: "<growthos.message-id@faithfulsoftware.dev>",
    subjectSnapshot: "Subject",
    htmlSnapshot: "<p>Body</p>",
    textSnapshot: "Body",
    followUps: [
      {
        stepNumber: 1,
        scheduledFor: new Date("2026-08-22T09:00:00.000Z"),
        idempotencyKey: "follow_up:1:enrollment-id",
      },
    ],
  });

  const queries = queriesOf(db);
  assert.match(queries[0]?.text ?? "", /update growth\.email_messages/);
  assert.match(queries[0]?.text ?? "", /status = 'sent'/);
  assert.match(queries[1]?.text ?? "", /update growth\.sequence_enrollments/);
  assert.match(queries[2]?.text ?? "", /insert into growth\.email_messages/);
  assert.match(
    queries[2]?.text ?? "",
    /on conflict \(idempotency_key\) do nothing/,
  );
});
