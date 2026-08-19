import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createSequenceResumer,
  SequenceResumeError,
  type AppendResumeAuditInput,
  type LockedEnrollment,
  type SequenceResumeRepository,
  type SequenceResumeTransaction,
} from "./resume";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const sequenceId = "11111111-1111-4111-8111-111111111111";

type FakeState = {
  enrollment: LockedEnrollment | null;
  applied: string[];
  audits: AppendResumeAuditInput[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    enrollment: { id: sequenceId, status: "paused" },
    applied: [],
    audits: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): SequenceResumeRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: SequenceResumeTransaction) => Promise<T>,
    ) {
      const transaction: SequenceResumeTransaction = {
        async lockEnrollment(id) {
          if (!state.enrollment || state.enrollment.id !== id) return null;
          return state.enrollment;
        },
        async applyResume(id) {
          state.applied.push(id);
          if (state.enrollment) state.enrollment.status = "active";
        },
        async appendResumeAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

const db = {} as GrowthDb;

function createResumer(state: FakeState) {
  return createSequenceResumer({ repository: createFakeRepository(state) });
}

test("resumes a paused sequence back to active", async () => {
  const state = createFakeState();
  const resume = createResumer(state);

  const result = await resume(db, { sequenceId, founder, correlationId: "c" });

  assert.equal(result.status, "active");
  assert.equal(result.alreadyApplied, false);
  assert.equal(state.applied.length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]?.actorId, founder.actorId);
});

test("resuming an already-active sequence is idempotent", async () => {
  const state = createFakeState({
    enrollment: { id: sequenceId, status: "active" },
  });
  const resume = createResumer(state);

  const result = await resume(db, { sequenceId, founder, correlationId: "c" });

  assert.equal(result.alreadyApplied, true);
  assert.equal(state.applied.length, 0);
  assert.equal(state.audits.length, 0);
});

test("a permanently stopped sequence cannot be resumed", async () => {
  for (const status of [
    "stopped_reply",
    "stopped_opt_out",
    "stopped_bounce",
    "stopped_rejected",
    "stopped_started_talks",
    "completed",
    "pending_approval",
  ]) {
    const state = createFakeState({ enrollment: { id: sequenceId, status } });
    const resume = createResumer(state);

    await assert.rejects(
      resume(db, { sequenceId, founder, correlationId: "c" }),
      (error: unknown) =>
        error instanceof SequenceResumeError && error.code === "not_resumable",
    );
    assert.equal(state.applied.length, 0);
  }
});

test("rejects an unknown sequence", async () => {
  const state = createFakeState({ enrollment: null });
  const resume = createResumer(state);

  await assert.rejects(
    resume(db, { sequenceId, founder, correlationId: "c" }),
    (error: unknown) =>
      error instanceof SequenceResumeError && error.code === "not_found",
  );
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const resume = createResumer(state);

  await assert.rejects(
    resume(db, { sequenceId: "not-a-uuid", founder, correlationId: "c" }),
    TypeError,
  );
  await assert.rejects(
    resume(db, { sequenceId, founder, correlationId: "" }),
    TypeError,
  );
  await assert.rejects(
    resume(db, {
      sequenceId,
      founder: { email: "founder@example.test", actorId: "not-hex" },
      correlationId: "c",
    }),
    TypeError,
  );
});
