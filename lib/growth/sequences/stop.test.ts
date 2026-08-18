import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createSequenceStopper,
  SequenceStopError,
  type ApplyStopInput,
  type AppendStopAuditInput,
  type InsertDoNotContactSuppressionInput,
  type LockedEnrollment,
  type SequenceStopRepository,
  type SequenceStopTransaction,
  type StopReason,
} from "./stop";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const gmailSyncActor = { type: "gmail_sync" as const, id: "gmail-sync" };
const sequenceId = "11111111-1111-4111-8111-111111111111";

function lockedEnrollment(
  overrides: Partial<LockedEnrollment> = {},
): LockedEnrollment {
  return {
    id: sequenceId,
    status: "active",
    normalisedEmail: "contact@example.test",
    businessId: "22222222-2222-4222-8222-222222222222",
    ...overrides,
  };
}

type FakeState = {
  enrollment: LockedEnrollment | null;
  cancelledCount: number;
  applied: ApplyStopInput[];
  suppressions: InsertDoNotContactSuppressionInput[];
  audits: AppendStopAuditInput[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    enrollment: lockedEnrollment(),
    cancelledCount: 2,
    applied: [],
    suppressions: [],
    audits: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): SequenceStopRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: SequenceStopTransaction) => Promise<T>,
    ) {
      const transaction: SequenceStopTransaction = {
        async lockEnrollment(id) {
          if (!state.enrollment || state.enrollment.id !== id) return null;
          return state.enrollment;
        },
        async cancelPendingMessages() {
          return { cancelledCount: state.cancelledCount };
        },
        async applyStop(input) {
          state.applied.push(input);
          if (state.enrollment) state.enrollment.status = input.status;
        },
        async insertDoNotContactSuppression(input) {
          state.suppressions.push(input);
        },
        async appendStopAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

const db = {} as GrowthDb;

function createStopper(state: FakeState) {
  return createSequenceStopper({ repository: createFakeRepository(state) });
}

const REASON_TO_STATUS: Record<StopReason, string> = {
  pause: "paused",
  started_talks: "stopped_started_talks",
  rejected: "stopped_rejected",
  do_not_contact: "stopped_opt_out",
  reply: "stopped_reply",
  bounce: "stopped_bounce",
};

for (const reason of Object.keys(REASON_TO_STATUS) as StopReason[]) {
  test(`stops a sequence for reason "${reason}" and cancels pending messages`, async () => {
    const state = createFakeState();
    const stopSequence = createStopper(state);

    const result = await stopSequence(db, {
      sequenceId,
      reason,
      actor: founder,
      correlationId: "correlation-id",
    });

    assert.equal(result.status, REASON_TO_STATUS[reason]);
    assert.equal(result.alreadyApplied, false);
    assert.equal(state.applied.length, 1);
    assert.equal(state.applied[0]?.status, REASON_TO_STATUS[reason]);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0]?.actorType, "founder");
  });
}

test("do_not_contact and bounce insert a global suppression; other reasons do not", async () => {
  for (const reason of ["do_not_contact", "bounce"] as const) {
    const state = createFakeState();
    const stopSequence = createStopper(state);
    await stopSequence(db, {
      sequenceId,
      reason,
      actor: founder,
      correlationId: "c",
    });
    assert.equal(state.suppressions.length, 1);
    assert.equal(
      state.suppressions[0]?.normalisedEmail,
      "contact@example.test",
    );
  }

  for (const reason of [
    "pause",
    "started_talks",
    "rejected",
    "reply",
  ] as const) {
    const state = createFakeState();
    const stopSequence = createStopper(state);
    await stopSequence(db, {
      sequenceId,
      reason,
      actor: founder,
      correlationId: "c",
    });
    assert.equal(state.suppressions.length, 0);
  }
});

test("repeating the same stop reason is idempotent and does not re-apply", async () => {
  const state = createFakeState({
    enrollment: lockedEnrollment({ status: "stopped_reply" }),
  });
  const stopSequence = createStopper(state);

  const result = await stopSequence(db, {
    sequenceId,
    reason: "reply",
    actor: gmailSyncActor,
    correlationId: "correlation-id",
  });

  assert.equal(result.alreadyApplied, true);
  assert.equal(result.status, "stopped_reply");
  assert.equal(state.applied.length, 0);
  assert.equal(state.audits.length, 0);
});

test("a later attempt to stop for a different reason throws once already stopped", async () => {
  const state = createFakeState({
    enrollment: lockedEnrollment({ status: "stopped_reply" }),
  });
  const stopSequence = createStopper(state);

  await assert.rejects(
    stopSequence(db, {
      sequenceId,
      reason: "rejected",
      actor: founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof SequenceStopError && error.code === "already_stopped",
  );
  assert.equal(state.applied.length, 0);
});

test("a completed sequence cannot be stopped for any reason", async () => {
  const state = createFakeState({
    enrollment: lockedEnrollment({ status: "completed" }),
  });
  const stopSequence = createStopper(state);

  await assert.rejects(
    stopSequence(db, {
      sequenceId,
      reason: "pause",
      actor: founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof SequenceStopError && error.code === "already_stopped",
  );
});

test("rejects an unknown sequence", async () => {
  const state = createFakeState({ enrollment: null });
  const stopSequence = createStopper(state);

  await assert.rejects(
    stopSequence(db, {
      sequenceId,
      reason: "pause",
      actor: founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof SequenceStopError && error.code === "not_found",
  );
});

test("records the gmail_sync actor as a cron audit entry", async () => {
  const state = createFakeState();
  const stopSequence = createStopper(state);

  await stopSequence(db, {
    sequenceId,
    reason: "reply",
    actor: gmailSyncActor,
    correlationId: "correlation-id",
  });

  assert.equal(state.audits[0]?.actorType, "cron");
  assert.equal(state.audits[0]?.actorId, "gmail-sync");
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const stopSequence = createStopper(state);

  await assert.rejects(
    stopSequence(db, {
      sequenceId: "not-a-uuid",
      reason: "pause",
      actor: founder,
      correlationId: "correlation-id",
    }),
    TypeError,
  );
  await assert.rejects(
    stopSequence(db, {
      sequenceId,
      reason: "pause",
      actor: { email: "founder@example.test", actorId: "not-hex" },
      correlationId: "correlation-id",
    }),
    TypeError,
  );
  await assert.rejects(
    stopSequence(db, {
      sequenceId,
      reason: "pause",
      actor: founder,
      correlationId: "",
    }),
    TypeError,
  );
});
