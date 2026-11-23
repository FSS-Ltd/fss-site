import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import type { BoundGmailClient } from "../integrations/gmail/live-client";
import { createOutreachDispatcher } from "./dispatcher";
import { postgresSequenceDispatchRepository } from "./dispatcher-repository";

const db = {} as GrowthDb;

test("refreshes account usage even when there are no due messages", async () => {
  let refreshed = 0;
  const dispatch = createOutreachDispatcher({
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => null,
    },
    bound: { binding: { connectionId: "connection" } } as BoundGmailClient,
    refreshUsage: async () => {
      refreshed += 1;
      return { status: "complete" };
    },
    reserve: async () => ({ status: "held", reason: "unused" }),
    submit: async () => ({ status: "held", reason: "unused" }),
    confirm: async () => ({ status: "held", reason: "unused" }),
  });
  await dispatch(db, new Date());
  assert.equal(refreshed, 1);
});

test("usage failure holds the batch before a claim", async () => {
  let claims = 0;
  const dispatch = createOutreachDispatcher({
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => {
        claims += 1;
        return null;
      },
    },
    bound: { binding: { connectionId: "connection" } } as BoundGmailClient,
    refreshUsage: async () => ({ status: "held", reason: "usage_unknown" }),
    reserve: async () => ({ status: "held", reason: "unused" }),
    submit: async () => ({ status: "held", reason: "unused" }),
    confirm: async () => ({ status: "held", reason: "unused" }),
  });
  assert.equal((await dispatch(db, new Date())).held, 1);
  assert.equal(claims, 0);
});

test("passes the current sync coverage ID through reservation and submission", async () => {
  const coverageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let reservationCoverage: string | null | undefined;
  let submissionCoverage: string | null | undefined;
  const dispatch = createOutreachDispatcher({
    bound: { binding: { connectionId: "connection" } } as BoundGmailClient,
    maxMessagesPerRun: 1,
    repository: {
      ...postgresSequenceDispatchRepository,
      claimPendingConfirmations: async () => [],
      claimDueMessage: async () => ({
        id: "11111111-1111-4111-8111-111111111111",
        previousStatus: "queued",
        sequenceEnrollmentId: "22222222-2222-4222-8222-222222222222",
        prospectId: "33333333-3333-4333-8333-333333333333",
        contactId: "44444444-4444-4444-8444-444444444444",
        stepNumber: 1,
        attemptCount: 0,
        rfcMessageId: null,
        idempotencyKey: "followup",
        subjectSnapshot: "subject",
        htmlSnapshot: "<p>body</p>",
        textSnapshot: "body",
      }),
      prepareLegacyMessage: async () => ({ status: "ready" }),
    },
    refreshUsage: async () => ({ status: "complete" }),
    reserve: async (_db, input) => {
      reservationCoverage = input.coverageId;
      return {
        status: "ready",
        value: {
          reservationId: "id",
          fence: 1,
          rfcMessageId: "<id>",
          preparation: {
            messageId: "id",
            sequenceId: "id",
            recipient: "a@example.test",
            subject: "subject",
            html: "<p>body</p>",
            text: "body",
            gmailThreadId: null,
            references: [],
            fingerprint: "a".repeat(64),
          },
        },
      };
    },
    submit: async (_db, input) => {
      submissionCoverage = input.coverageId;
      return { status: "accepted" };
    },
    confirm: async () => ({ status: "ready" }),
  });
  await dispatch(db, new Date(), undefined, coverageId);
  assert.equal(reservationCoverage, coverageId);
  assert.equal(submissionCoverage, coverageId);
});
