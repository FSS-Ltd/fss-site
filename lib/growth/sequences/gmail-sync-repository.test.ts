import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { postgresGmailSyncRepository } from "./gmail-sync-repository";

function fakeDb(
  handler: (text: string, values: readonly unknown[]) => unknown[],
): GrowthDb {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const tagged = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    return handler(text, values);
  }) as unknown as GrowthTransaction;
  Object.assign(tagged, {
    json: (value: unknown) => value,
    __queries: queries,
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(tagged),
  });
  return tagged as unknown as GrowthDb;
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

test("reads and writes the Gmail sync cursor", async () => {
  const db = fakeDb((text) =>
    text.startsWith("select provider_cursor")
      ? [{ providerCursor: "12345" }]
      : [],
  );

  const cursor = await postgresGmailSyncRepository.getCursor(
    db,
    "j.ntagengwa@faithfulsoftware.dev",
  );
  assert.equal(cursor, "12345");

  await postgresGmailSyncRepository.setCursor(
    db,
    "j.ntagengwa@faithfulsoftware.dev",
    "67890",
  );
  const setQuery = queriesOf(db)[1]!;
  assert.match(setQuery.text, /update growth\.integration_connections/);
  assert.deepEqual(setQuery.values, [
    "67890",
    "j.ntagengwa@faithfulsoftware.dev",
  ]);
});

test("inserts the inbound message then its event, and detects a duplicate", async () => {
  const db = fakeDb((text) => {
    if (text.startsWith("insert into growth.email_messages")) {
      return [{ id: "inbound-message-id" }];
    }
    return [];
  });

  const result = await postgresGmailSyncRepository.recordInboundEvent(db, {
    sequenceEnrollmentId: "enrollment-id",
    prospectId: "prospect-id",
    contactId: "contact-id",
    gmailMessageId: "gmail-message-1",
    gmailThreadId: "gmail-thread-1",
    rfcMessageId: "<reply@example.test>",
    from: "sam@example.test",
    subject: "Re: A practical idea",
    receivedAt: new Date("2026-08-18T09:00:00.000Z"),
    eventType: "reply",
  });

  assert.equal(result.alreadyRecorded, false);
  const queries = queriesOf(db);
  assert.match(queries[0]?.text ?? "", /insert into growth\.email_messages/);
  assert.match(
    queries[0]?.text ?? "",
    /on conflict \(channel, provider_message_id\) where provider_message_id is not null do nothing/,
  );
  assert.match(queries[1]?.text ?? "", /insert into growth\.email_events/);
});

test("treats a conflicting inbound message insert as already recorded", async () => {
  const db = fakeDb(() => []);

  const result = await postgresGmailSyncRepository.recordInboundEvent(db, {
    sequenceEnrollmentId: "enrollment-id",
    prospectId: "prospect-id",
    contactId: "contact-id",
    gmailMessageId: "gmail-message-1",
    gmailThreadId: "gmail-thread-1",
    rfcMessageId: null,
    from: "sam@example.test",
    subject: null,
    receivedAt: new Date(),
    eventType: "reply",
  });

  assert.equal(result.alreadyRecorded, true);
  assert.equal(queriesOf(db).length, 1);
});

test("activates a pending-approval enrollment only", async () => {
  const db = fakeDb(() => []);

  await postgresGmailSyncRepository.activatePendingApproval(
    db,
    "enrollment-id",
  );

  const query = queriesOf(db)[0]!;
  assert.match(query.text, /status = 'active'/);
  assert.match(query.text, /status = 'pending_approval'/);
});
