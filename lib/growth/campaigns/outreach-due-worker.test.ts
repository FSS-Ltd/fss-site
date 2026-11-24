import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import type { BoundGmailClient } from "../integrations/gmail/live-client";
import { createOutreachDueWorker } from "./outreach-due-worker";

const db = {} as GrowthDb;
const bound = { binding: { connectionId: "account" } } as BoundGmailClient;
const empty = { claimed: 0, prepared: 0, held: 0, retry: 0 };

test("shares 25 slots and carries the current sync coverage to follow-ups", async () => {
  const seen: string[] = [];
  const worker = createOutreachDueWorker({
    bound,
    workerId: "worker",
    refreshUsage: async (_db, actual) => {
      assert.equal(actual, bound);
      seen.push("usage");
      return { status: "complete" };
    },
    sync: async (_db, actual) => {
      assert.equal(actual, bound);
      seen.push("sync");
      return { coverageId: "coverage-current" };
    },
    first: async (_db, input) => {
      seen.push(`first:${input.limit}`);
      return { ...empty, claimed: Math.min(input.limit, 13) };
    },
    claimFollowUps: async (_db, input) => {
      seen.push(`follow:${input.limit}`);
      return [{ id: "job", revision: "1" }];
    },
    prepareFollowUp: async (_db, input) => {
      seen.push(`prepare:${input.coverageId}`);
      return {
        status: "ready",
        value: { messageId: "message", step: 1, alreadyExisted: false },
      };
    },
    settleFollowUp: async () => {
      throw new Error("unexpected settlement");
    },
  });
  const summary = await worker(db);
  assert.equal(summary.first.claimed, 24);
  assert.equal(summary.followUp.claimed, 1);
  assert.deepEqual(seen, [
    "usage",
    "sync",
    "first:13",
    "follow:12",
    "prepare:coverage-current",
    "first:11",
  ]);
});

test("usage hold stops all preparation", async () => {
  let otherCalls = 0;
  const worker = createOutreachDueWorker({
    bound,
    workerId: "worker",
    refreshUsage: async () => ({ status: "held", reason: "usage_unknown" }),
    sync: async () => {
      otherCalls++;
      return { coverageId: null };
    },
    first: async () => {
      otherCalls++;
      return empty;
    },
    claimFollowUps: async () => {
      otherCalls++;
      return [];
    },
    prepareFollowUp: async () => {
      otherCalls++;
      return { status: "held", reason: "unused" };
    },
    settleFollowUp: async () => {
      otherCalls++;
      return "held";
    },
  });
  const summary = await worker(db);
  assert.equal(summary.usage, "held");
  assert.equal(otherCalls, 0);
});

test("a sync without committed coverage never claims follow-ups", async () => {
  let followCalls = 0;
  let syncCalls = 0;
  const worker = createOutreachDueWorker({
    bound,
    workerId: "worker",
    refreshUsage: async () => ({ status: "complete" }),
    sync: async () => {
      syncCalls++;
      return { coverageId: null };
    },
    first: async () => empty,
    claimFollowUps: async () => {
      followCalls++;
      return [];
    },
    prepareFollowUp: async () => {
      followCalls++;
      return { status: "held", reason: "unused" };
    },
    settleFollowUp: async () => {
      followCalls++;
      return "held";
    },
  });
  const summary = await worker(db);
  assert.equal(syncCalls, 1);
  assert.equal(followCalls, 0);
  assert.equal(summary.followUp.claimed, 0);
});

test("held follow-up results settle only through the matching lease", async () => {
  const settled: string[] = [];
  const worker = createOutreachDueWorker({
    bound,
    workerId: "worker",
    refreshUsage: async () => ({ status: "complete" }),
    sync: async () => ({ coverageId: "coverage" }),
    first: async () => empty,
    claimFollowUps: async () => [{ id: "job", revision: "7" }],
    prepareFollowUp: async () => ({
      status: "held",
      reason: "reply_coverage_unknown",
    }),
    settleFollowUp: async (_db, input) => {
      settled.push(
        `${input.jobId}:${input.leaseOwner}:${input.leaseRevision}:${input.reason}`,
      );
      return "retry";
    },
  });
  const summary = await worker(db);
  assert.deepEqual(settled, ["job:worker:7:reply_coverage_unknown"]);
  assert.equal(summary.followUp.retry, 1);
});
