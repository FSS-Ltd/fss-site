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
    if (text.startsWith("select status, google_subject"))
      return [
        {
          status: "connected",
          subject: "subject",
          version: 1,
          scopes: [
            "openid",
            "email",
            "https://www.googleapis.com/auth/gmail.modify",
          ],
        },
      ];
    if (text.startsWith("select p.business_id"))
      return [{ businessId: "business" }];
    if (text.startsWith("select verified_subject"))
      return [{ subject: "subject" }];
    if (text.startsWith("select se.id") && text.includes("for update of se"))
      return [
        {
          id: "enrollment-id",
          status: "active",
          normalisedEmail: "a@example.test",
          businessId: "business",
          gmailThreadId: "gmail-thread-1",
        },
      ];
    if (text.startsWith("select id from growth.outreach_reservations"))
      return [{ id: "reservation" }];
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
    if (text.startsWith("insert into growth.email_events")) {
      return [{ id: "inbound-event-id" }];
    }
    return [];
  });

  const input = {
    binding: {
      connectionId: "account",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
    sequenceEnrollmentId: "enrollment-id",
    prospectId: "prospect-id",
    contactId: "contact-id",
    gmailMessageId: "gmail-message-1",
    gmailThreadId: "gmail-thread-1",
    rfcMessageId: "<reply@example.test>",
    from: "sam@example.test",
    subject: "Re: A practical idea",
    receivedAt: new Date("2026-08-18T09:00:00.000Z"),
    eventType: "auto_response" as const,
    correlationId: "test",
  };
  const result = await postgresGmailSyncRepository.recordInboundEvent(
    db,
    input,
  );

  assert.equal(result.alreadyRecorded, false);
  const queries = queriesOf(db);
  const inserted = queries.find((query) =>
    query.text.startsWith("insert into growth.email_messages"),
  );
  assert.match(inserted?.text ?? "", /insert into growth\.email_messages/);
  assert.match(
    inserted?.text ?? "",
    /on conflict \(channel, provider_message_id\) where provider_message_id is not null do nothing/,
  );
  assert.ok(
    queries.some((query) =>
      query.text.startsWith("insert into growth.email_events"),
    ),
  );
  const conflictingDb = fakeDb((text) =>
    text.startsWith("insert into growth.email_messages")
      ? [{ id: "new-message-id" }]
      : [],
  );
  await assert.rejects(
    postgresGmailSyncRepository.recordInboundEvent(conflictingDb, input),
    /Gmail inbound event attribution conflict/,
  );
});

test("treats a matching inbound event as already recorded", async () => {
  const db = fakeDb((text) =>
    text.startsWith("select em.sequence_enrollment_id")
      ? [
          {
            sequenceEnrollmentId: "enrollment-id",
            gmailThreadId: "gmail-thread-1",
            eventType: "auto_response",
          },
        ]
      : [],
  );

  const result = await postgresGmailSyncRepository.recordInboundEvent(db, {
    binding: {
      connectionId: "account",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
    sequenceEnrollmentId: "enrollment-id",
    prospectId: "prospect-id",
    contactId: "contact-id",
    gmailMessageId: "gmail-message-1",
    gmailThreadId: "gmail-thread-1",
    rfcMessageId: null,
    from: "sam@example.test",
    subject: null,
    receivedAt: new Date(),
    eventType: "auto_response",
    correlationId: "test",
  });

  assert.equal(result.alreadyRecorded, true);
  assert.equal(
    queriesOf(db).filter((query) =>
      query.text.startsWith("insert into growth.email_events"),
    ).length,
    0,
  );
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

test("does not choose an enrollment when a Gmail thread maps to multiple enrollments", async () => {
  const db = fakeDb(() => [
    { id: "one", status: "active", prospectId: "p1", contactId: "c1" },
    { id: "two", status: "active", prospectId: "p2", contactId: "c2" },
  ]);

  assert.deepEqual(
    await postgresGmailSyncRepository.findEnrollmentByThread(
      db,
      "shared-thread",
      {
        connectionId: "account",
        googleSubject: "subject",
        grantEpoch: 1,
        grantedScopes: [],
      },
    ),
    { kind: "ambiguous" },
  );
});

test("rejects an inbound provider ID already attributed to another enrollment", async () => {
  const db = fakeDb((text) =>
    text.startsWith("select em.sequence_enrollment_id")
      ? [
          {
            sequenceEnrollmentId: "other",
            gmailThreadId: "gmail-thread-1",
            eventType: "auto_response",
          },
        ]
      : [],
  );
  await assert.rejects(
    postgresGmailSyncRepository.recordInboundEvent(db, {
      binding: {
        connectionId: "account",
        googleSubject: "subject",
        grantEpoch: 1,
        grantedScopes: [
          "openid",
          "email",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
      },
      sequenceEnrollmentId: "enrollment-id",
      prospectId: "p",
      contactId: "c",
      gmailMessageId: "gmail-message-1",
      gmailThreadId: "gmail-thread-1",
      rfcMessageId: null,
      from: null,
      subject: null,
      receivedAt: new Date(),
      eventType: "auto_response",
      correlationId: "test",
    }),
    /conflict/i,
  );
});
