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
  ).__queries.filter((query) => !query.text.includes("growth:gmail-routing"));
}

test("claims one due message without counting an unissued attempt", async () => {
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
  const query = queriesOf(db).find((item) =>
    item.text.startsWith("with target"),
  );
  assert.ok(query);
  assert.match(query.text, /for update of em skip locked/);
  assert.match(query.text, /status in \('queued', 'retry'\)/);
  assert.match(query.text, /lease_expires_at < \?/);
  assert.doesNotMatch(query.text, /attempt_count = em\.attempt_count \+ 1/);
  assert.match(query.text, /outreach_guarded_claim/);
  assert.match(query.text, /confirmation_observed_at is not null/);
  assert.match(query.text, /direct_noninvocation_evidence is not null/);
});

test("reclaims only expired, unissued reservations before claiming", async () => {
  const db = fakeDb((text) =>
    text.startsWith("select r.id from growth.outreach_reservations")
      ? [{ id: "reservation-id" }]
      : [],
  );
  await postgresSequenceDispatchRepository.claimDueMessage(db, {
    now: new Date("2026-08-18T09:00:00.000Z"),
    leaseToken: "lease-token",
    leaseExpiresAt: new Date("2026-08-18T09:05:00.000Z"),
  });
  const queries = queriesOf(db);
  const selection = queries.find((item) =>
    item.text.startsWith("select r.id from growth.outreach_reservations"),
  );
  const cancellation = queries.find((item) =>
    item.text.startsWith("update growth.outreach_reservations"),
  );
  assert.ok(selection && cancellation);
  assert.match(selection.text, /r\.status='reserved'/);
  assert.match(
    selection.text,
    /r\.submitted_at is null and r\.issued_snapshot is null/,
  );
  assert.match(selection.text, /r\.lease_until<=clock_timestamp\(\)/);
  assert.match(
    selection.text,
    /em\.lease_expires_at<=clock_timestamp\(\) and em\.lease_token=r\.lease_token/,
  );
  assert.match(
    cancellation.text,
    /status='reserved' and submitted_at is null and issued_snapshot is null/,
  );
  assert.ok(
    queries.indexOf(cancellation) <
      queries.findIndex((item) => item.text.startsWith("with target")),
  );
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
  assert.match(queries[0]?.text ?? "", /pg_advisory_xact_lock/);
  assert.match(queries[1]?.text ?? "", /update growth\.email_messages/);
  assert.match(queries[1]?.text ?? "", /status = 'sent'/);
  assert.match(queries[2]?.text ?? "", /update growth\.sequence_enrollments/);
  assert.match(queries[3]?.text ?? "", /insert into growth\.email_messages/);
  assert.match(
    queries[3]?.text ?? "",
    /on conflict \(idempotency_key\) do nothing/,
  );
});

test("preparation holds when the claim lease is no longer current", async () => {
  const db = fakeDb(() => []);
  const result = await postgresSequenceDispatchRepository.prepareLegacyMessage(
    db,
    {
      messageId: "message-id",
      leaseToken: "lease-token",
      claimed: {
        id: "message-id",
        previousStatus: "queued",
        sequenceEnrollmentId: "sequence-id",
        prospectId: "prospect-id",
        contactId: "contact-id",
        stepNumber: 0,
        attemptCount: 1,
        rfcMessageId: null,
        idempotencyKey: "key",
        subjectSnapshot: null,
        htmlSnapshot: null,
        textSnapshot: null,
      },
    },
  );
  assert.deepEqual(result, { status: "held", reason: "lease_invalid" });
});

test("preparation refuses content changed after the claim", async () => {
  const db = fakeDb((text) => {
    if (text.startsWith("select p.id as"))
      return [
        {
          prospectId: "prospect-id",
          businessId: "business-id",
          contactId: "contact-id",
          sequenceId: "sequence-id",
        },
      ];
    if (text.startsWith("select em.step_number as"))
      return [
        {
          step: 0,
          subject: "changed",
          html: "<p>Body</p>",
          text: "Body",
          firstName: "Sam",
          businessName: "Example",
          firstSubject: "changed",
          campaign: false,
        },
      ];
    return [];
  });
  const result = await postgresSequenceDispatchRepository.prepareLegacyMessage(
    db,
    {
      messageId: "message-id",
      leaseToken: "lease-token",
      claimed: {
        id: "message-id",
        previousStatus: "queued",
        sequenceEnrollmentId: "sequence-id",
        prospectId: "prospect-id",
        contactId: "contact-id",
        stepNumber: 0,
        attemptCount: 1,
        rfcMessageId: null,
        idempotencyKey: "key",
        subjectSnapshot: "reviewed",
        htmlSnapshot: "<p>Body</p>",
        textSnapshot: "Body",
      },
    },
  );
  assert.deepEqual(result, {
    status: "held",
    reason: "claimed_content_changed",
  });
});

test("claim and expired cleanup are both scoped to the selected provider", async () => {
  for (const channel of [undefined, "resend"] as const) {
    const db = fakeDb(() => []);
    await postgresSequenceDispatchRepository.claimDueMessage(db, {
      now: new Date(),
      leaseToken: "test-lease",
      leaseExpiresAt: new Date(),
      ...(channel ? { channel } : {}),
    });
    const queries = queriesOf(db);
    const cleanup = queries.find((q) =>
      q.text.startsWith("select r.id from growth.outreach_reservations"),
    );
    const claim = queries.find((q) => q.text.startsWith("with target"));
    assert.ok(cleanup && claim);
    for (const query of [cleanup, claim]) {
      assert.match(query.text, /em\.channel=\?/);
      assert.ok(query.values.includes(channel ?? "gmail"));
      assert.match(query.text, /em\.step_number=0/);
      assert.match(query.text, /c\.policy->>'provider'='resend'/);
    }
  }
});
