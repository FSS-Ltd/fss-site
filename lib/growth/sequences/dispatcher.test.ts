import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import type { BoundGmailClient } from "../integrations/gmail/live-client";
import {
  createOutreachDispatcher,
  scheduledFollowUpsForFirstSend,
} from "./dispatcher";
import {
  postgresSequenceDispatchRepository,
  type ClaimedMessage,
} from "./dispatcher-repository";

const db = {} as GrowthDb;
const bound = { binding: { connectionId: "connection" } } as BoundGmailClient;
const now = new Date("2026-08-18T09:00:00.000Z");
const claimed: ClaimedMessage = {
  id: "11111111-1111-4111-8111-111111111111",
  previousStatus: "queued",
  sequenceEnrollmentId: "22222222-2222-4222-8222-222222222222",
  prospectId: "33333333-3333-4333-8333-333333333333",
  contactId: "44444444-4444-4444-8444-444444444444",
  stepNumber: 0,
  attemptCount: 1,
  rfcMessageId: null,
  idempotencyKey: "first",
  subjectSnapshot: "Subject",
  htmlSnapshot: "<p>Body</p>",
  textSnapshot: "Body",
};
const reserved = {
  reservationId: "55555555-5555-4555-8555-555555555555",
  fence: 1,
  rfcMessageId: "<example>",
  preparation: {
    messageId: claimed.id,
    sequenceId: claimed.sequenceEnrollmentId,
    recipient: "a@example.test",
    subject: "Subject",
    html: "<p>Body</p>",
    text: "Body",
    gmailThreadId: null,
    references: [],
    fingerprint: "a".repeat(64),
  },
};

test("accepted submission remains unconfirmed when observation is held", async () => {
  let claims = 0;
  let submitted = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    createLeaseToken: () => "lease",
    maxMessagesPerRun: 1,
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => {
        claims++;
        return claimed;
      },
      prepareLegacyMessage: async (_db, input) => {
        assert.equal(input.claimed, claimed);
        return { status: "ready" };
      },
    },
    refreshUsage: async (_db, account) => {
      assert.equal(account, bound);
      return { status: "complete" };
    },
    reserve: async (_db, input) => {
      assert.equal(input.leaseToken, "lease");
      return { status: "ready", value: reserved };
    },
    submit: async (_db, input) => {
      submitted++;
      assert.equal(input.bound, bound);
      assert.equal(input.fingerprint, reserved.preparation.fingerprint);
      return { status: "accepted" };
    },
    confirm: async () => ({ status: "held", reason: "not_observed" }),
  });
  const summary = await dispatch(db, now);
  assert.equal(claims, 1);
  assert.equal(submitted, 1);
  assert.equal(summary.accepted, 1);
  assert.equal(summary.confirmed, 0);
});

test("uncertain submission stops the batch without a retry or confirmation", async () => {
  let claims = 0;
  let confirmed = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    createLeaseToken: () => "lease",
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => {
        claims++;
        return claimed;
      },
      prepareLegacyMessage: async () => ({ status: "ready" }),
    },
    refreshUsage: async () => ({ status: "complete" }),
    reserve: async () => ({ status: "ready", value: reserved }),
    submit: async () => ({ status: "uncertain", reason: "transport_unknown" }),
    confirm: async () => {
      confirmed++;
      return { status: "ready" };
    },
  });
  const summary = await dispatch(db, now);
  assert.equal(summary.uncertain, 1);
  assert.equal(claims, 1);
  assert.equal(confirmed, 0);
});

test("legacy cadence keeps the day 5 and day 14 follow-ups", () => {
  assert.deepEqual(
    scheduledFollowUpsForFirstSend(claimed.sequenceEnrollmentId, now).map(
      (item) => item.stepNumber,
    ),
    [1, 3],
  );
});

test("a failed confirmation keeps acceptance pending and stops the batch", async () => {
  let claims = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    createLeaseToken: () => "lease",
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => {
        claims++;
        return claimed;
      },
      prepareLegacyMessage: async () => ({ status: "ready" }),
    },
    refreshUsage: async () => ({ status: "complete" }),
    reserve: async () => ({ status: "ready", value: reserved }),
    submit: async () => ({ status: "accepted" }),
    confirm: async () => {
      throw new Error("provider read failed");
    },
  });
  const summary = await dispatch(db, now);
  assert.equal(summary.accepted, 1);
  assert.equal(summary.confirmed, 0);
  assert.equal(claims, 1);
});

test("an unexpected submission error remains uncertain and stops the batch", async () => {
  let claims = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    createLeaseToken: () => "lease",
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => {
        claims++;
        return claimed;
      },
      prepareLegacyMessage: async () => ({ status: "ready" }),
    },
    refreshUsage: async () => ({ status: "complete" }),
    reserve: async () => ({ status: "ready", value: reserved }),
    submit: async () => {
      throw new Error("submission lost");
    },
    confirm: async () => ({ status: "ready" }),
  });
  const summary = await dispatch(db, now);
  assert.equal(summary.uncertain, 1);
  assert.equal(claims, 1);
});

test("later batches confirm accepted receipts even when one observation remains held", async () => {
  const seen: string[] = [];
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => ["old", "new"],
    },
    refreshUsage: async () => ({ status: "held", reason: "usage_unknown" }),
    reserve: async () => ({ status: "held", reason: "unused" }),
    submit: async () => ({ status: "held", reason: "unused" }),
    confirm: async (_db, id) => {
      seen.push(id);
      return id === "old"
        ? { status: "held", reason: "not_observed" }
        : { status: "ready" };
    },
  });
  const summary = await dispatch(db, now);
  assert.deepEqual(seen, ["old", "new"]);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.claimed, 0);
});

test("targeted send does not scan unrelated pending confirmations", async () => {
  let scans = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => {
        scans++;
        return [];
      },
    },
    refreshUsage: async () => ({ status: "held", reason: "usage_unknown" }),
    reserve: async () => ({ status: "held", reason: "unused" }),
    submit: async () => ({ status: "held", reason: "unused" }),
    confirm: async () => ({ status: "held", reason: "unused" }),
  });
  await dispatch(db, now, claimed.id);
  assert.equal(scans, 0);
});

test("a message-specific hold does not starve the next due message", async () => {
  const excluded: string[][] = [];
  let claims = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    createLeaseToken: () => "lease",
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async (_db, input) => {
        excluded.push([...(input.excludeMessageIds ?? [])]);
        claims++;
        return claims === 1
          ? claimed
          : claims === 2
            ? { ...claimed, id: "other" }
            : null;
      },
      prepareLegacyMessage: async (_db, input) =>
        input.messageId === claimed.id
          ? { status: "held", reason: "message_unprepared" }
          : { status: "ready" },
    },
    refreshUsage: async () => ({ status: "complete" }),
    reserve: async () => ({ status: "ready", value: reserved }),
    submit: async () => ({ status: "accepted" }),
    confirm: async () => ({ status: "ready" }),
  });
  const summary = await dispatch(db, now);
  assert.equal(summary.claimed, 2);
  assert.equal(summary.confirmed, 1);
  assert.deepEqual(excluded[1], [claimed.id]);
});

test("a shared budget hold stops the batch before another claim", async () => {
  let claims = 0;
  const dispatch = createOutreachDispatcher({
    bound,
    now: () => now,
    createLeaseToken: () => "lease",
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => {
        claims++;
        return claimed;
      },
      prepareLegacyMessage: async () => ({ status: "ready" }),
    },
    refreshUsage: async () => ({ status: "complete" }),
    reserve: async () => ({ status: "held", reason: "account_limit" }),
    submit: async () => ({ status: "held", reason: "unused" }),
    confirm: async () => ({ status: "held", reason: "unused" }),
  });
  const summary = await dispatch(db, now);
  assert.equal(summary.held, 1);
  assert.equal(claims, 1);
});
