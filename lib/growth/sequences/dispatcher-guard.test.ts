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
