import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import type { StopSequenceInput, StoppedSequence } from "../sequences/stop";
import { createAutomationPauser } from "./pause-automations";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const correlationId = "test-correlation-id";
const fakeDb = {} as GrowthDb;

function createFakeStopSequence(
  behaviour: Record<string, StoppedSequence>,
): {
  stopSequence: (db: GrowthDb, input: StopSequenceInput) => Promise<StoppedSequence>;
  calls: StopSequenceInput[];
} {
  const calls: StopSequenceInput[] = [];
  return {
    calls,
    stopSequence: async (_db, input) => {
      calls.push(input);
      const result = behaviour[input.sequenceId];
      if (!result) throw new Error(`Unexpected sequenceId: ${input.sequenceId}`);
      return result;
    },
  };
}

test("pauses every active sequence and counts only the ones that actually changed", async () => {
  const { stopSequence, calls } = createFakeStopSequence({
    "seq-1": { sequenceId: "seq-1", status: "paused", alreadyApplied: false },
    "seq-2": { sequenceId: "seq-2", status: "paused", alreadyApplied: false },
    "seq-3": { sequenceId: "seq-3", status: "paused", alreadyApplied: true },
  });

  const pauseAllActiveAutomations = createAutomationPauser({
    listActiveSequenceIds: async () => ["seq-1", "seq-2", "seq-3"],
    stopSequence,
  });

  const result = await pauseAllActiveAutomations(fakeDb, { founder, correlationId });

  assert.equal(result.pausedSequenceCount, 2);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.reason, "pause");
    assert.equal(call.correlationId, correlationId);
    assert.deepEqual(call.actor, founder);
  }
});

test("does nothing and reports zero when no sequence is active", async () => {
  const { stopSequence, calls } = createFakeStopSequence({});

  const pauseAllActiveAutomations = createAutomationPauser({
    listActiveSequenceIds: async () => [],
    stopSequence,
  });

  const result = await pauseAllActiveAutomations(fakeDb, { founder, correlationId });

  assert.equal(result.pausedSequenceCount, 0);
  assert.equal(calls.length, 0);
});
