import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchRequestNotifications,
  requestEmailIdempotencyKey,
  type RequestEmailDelivery,
} from "./notifications";

type SqlCall = { sql: string; values: unknown[] };

function fakeDb(log: SqlCall[], rows: Record<string, unknown[]> = {}) {
  const query = async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown[]> => {
    const sql = parts.join("?");
    log.push({ sql, values });
    if (sql.includes("dispatch_request_notifications")) {
      return [{ dispatched: rows.dispatched ?? 0 }];
    }
    for (const key of Object.keys(rows)) {
      if (key === "dispatched") continue;
      if (sql.includes(key)) return rows[key];
    }
    return [];
  };
  return query as unknown as Parameters<
    typeof dispatchRequestNotifications
  >[0];
}

const delivery: RequestEmailDelivery = {
  id: "30000000-0000-4000-8000-000000000001",
  organisationId: "10000000-0000-4000-8000-000000000002",
  requestId: "20000000-0000-4000-8000-000000000003",
  kind: "review_requested",
  recipient: "owner@example.test",
  attempts: 1,
  requestTitle: "Synthetic request",
  deliverableVersion: "v2",
  publicSummary: "Summary",
  reviewInstructions: "Check the deliverable",
  organisationName: "Client",
};

test("request email dispatcher sends due deliveries and records the receipt", async () => {
  const calls: SqlCall[] = [];
  const db = fakeDb(calls, {
    "operations.claim_request_emails": [{ ...delivery }],
  });
  const sent: Array<Record<string, unknown>> = [];
  const summary = await dispatchRequestNotifications(db, {
    sender: async (input) => {
      sent.push(input);
      return {
        status: "succeeded",
        receipt: { providerId: "re_123", acceptedAt: new Date(0).toISOString() },
      };
    },
  });
  assert.deepEqual(summary, {
    fannedOut: 0,
    emailsClaimed: 1,
    emailsSent: 1,
    emailsHeld: 0,
  });
  assert.equal(sent.length, 1);
  assert.equal((sent[0].email as { to?: string }).to, "owner@example.test");
  assert.match(
    String((sent[0].email as { subject?: string }).subject),
    /Ready for your review/,
  );
  const complete = calls.find((call) =>
    call.sql.includes("complete_request_email"),
  );
  assert.ok(complete);
  assert.deepEqual(complete.values[0], delivery.id);
});

test("request email dispatcher holds non-email kinds and retries transport failures", async () => {
  const calls: SqlCall[] = [];
  const db = fakeDb(calls, {
    "operations.claim_request_emails": [
      { ...delivery, kind: "status_changed" as never },
      { ...delivery, id: "30000000-0000-4000-8000-000000000004", attempts: 6 },
    ],
  });
  let sends = 0;
  const summary = await dispatchRequestNotifications(db, {
    sender: async () => {
      sends++;
      return { status: "failed", code: "unknown_outcome", retryable: true, uncertain: true };
    },
    now: () => new Date(0),
  });
  assert.equal(sends, 1);
  assert.equal(summary.emailsClaimed, 2);
  assert.equal(summary.emailsHeld, 2);
  assert.equal(summary.emailsSent, 0);
  const fail = calls.find((call) => call.sql.includes("fail_request_email"));
  assert.ok(fail);
  // Non-email kind held permanently (next_attempt null, held true).
  assert.deepEqual([fail.values[3]], [true]);
});

test("request email idempotency keys are deterministic per delivery and attempt", async () => {
  assert.equal(
    requestEmailIdempotencyKey(delivery.id, 1),
    requestEmailIdempotencyKey(delivery.id, 1),
  );
  assert.notEqual(
    requestEmailIdempotencyKey(delivery.id, 1),
    requestEmailIdempotencyKey(delivery.id, 2),
  );
});
