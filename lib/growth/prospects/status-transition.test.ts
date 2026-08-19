import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createProspectStatusTransitioner,
  ProspectStatusTransitionError,
  type AppendProspectTransitionAuditInput,
  type ApplyProspectTransitionInput,
  type InsertDoNotContactSuppressionInput,
  type LockedProspect,
  type ProspectStatusTransitionReason,
  type ProspectStatusTransitionRepository,
  type ProspectStatusTransitionTransaction,
} from "./status-transition";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const prospectId = "11111111-1111-4111-8111-111111111111";

function lockedProspect(overrides: Partial<LockedProspect> = {}): LockedProspect {
  return {
    id: prospectId,
    status: "qualified",
    version: 3,
    normalisedEmail: "contact@example.test",
    businessId: "22222222-2222-4222-8222-222222222222",
    ...overrides,
  };
}

type FakeState = {
  prospect: LockedProspect | null;
  applied: ApplyProspectTransitionInput[];
  suppressions: InsertDoNotContactSuppressionInput[];
  audits: AppendProspectTransitionAuditInput[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    prospect: lockedProspect(),
    applied: [],
    suppressions: [],
    audits: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): ProspectStatusTransitionRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: ProspectStatusTransitionTransaction) => Promise<T>,
    ) {
      const transaction: ProspectStatusTransitionTransaction = {
        async lockProspect(id) {
          if (!state.prospect || state.prospect.id !== id) return null;
          return state.prospect;
        },
        async applyTransition(input) {
          state.applied.push(input);
          if (state.prospect) state.prospect.status = input.status;
        },
        async insertDoNotContactSuppression(input) {
          state.suppressions.push(input);
        },
        async appendTransitionAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

const db = {} as GrowthDb;

function createTransitioner(state: FakeState) {
  return createProspectStatusTransitioner({
    repository: createFakeRepository(state),
  });
}

const REASON_TO_STATUS: Record<ProspectStatusTransitionReason, string> = {
  reject: "rejected",
  do_not_contact: "suppressed",
  started_talks: "started_talks",
};

for (const reason of Object.keys(REASON_TO_STATUS) as ProspectStatusTransitionReason[]) {
  test(`transitions a prospect for reason "${reason}"`, async () => {
    const state = createFakeState();
    const transition = createTransitioner(state);

    const result = await transition(db, {
      prospectId,
      reason,
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    });

    assert.equal(result.status, REASON_TO_STATUS[reason]);
    assert.equal(result.alreadyApplied, false);
    assert.equal(state.applied.length, 1);
    assert.equal(state.applied[0]?.status, REASON_TO_STATUS[reason]);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0]?.reason, reason);
  });
}

test("only do_not_contact inserts a suppression", async () => {
  for (const reason of ["do_not_contact"] as const) {
    const state = createFakeState();
    const transition = createTransitioner(state);
    await transition(db, { prospectId, reason, expectedVersion: 3, founder, correlationId: "c" });
    assert.equal(state.suppressions.length, 1);
    assert.equal(state.suppressions[0]?.normalisedEmail, "contact@example.test");
  }

  for (const reason of ["reject", "started_talks"] as const) {
    const state = createFakeState();
    const transition = createTransitioner(state);
    await transition(db, { prospectId, reason, expectedVersion: 3, founder, correlationId: "c" });
    assert.equal(state.suppressions.length, 0);
  }
});

test("repeating the same transition is idempotent and does not require a fresh version", async () => {
  const state = createFakeState({ prospect: lockedProspect({ status: "rejected" }) });
  const transition = createTransitioner(state);

  const result = await transition(db, {
    prospectId,
    reason: "reject",
    expectedVersion: 999,
    founder,
    correlationId: "correlation-id",
  });

  assert.equal(result.alreadyApplied, true);
  assert.equal(result.status, "rejected");
  assert.equal(state.applied.length, 0);
  assert.equal(state.audits.length, 0);
});

test("rejects a stale version with a conflict error", async () => {
  const state = createFakeState({ prospect: lockedProspect({ version: 5 }) });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(db, {
      prospectId,
      reason: "reject",
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectStatusTransitionError &&
      error.code === "version_conflict",
  );
  assert.equal(state.applied.length, 0);
});

test("a terminal prospect cannot transition to a different terminal state", async () => {
  const state = createFakeState({
    prospect: lockedProspect({ status: "suppressed", version: 3 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(db, {
      prospectId,
      reason: "reject",
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectStatusTransitionError &&
      error.code === "already_terminal",
  );
});

test("rejects an unknown prospect", async () => {
  const state = createFakeState({ prospect: null });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(db, {
      prospectId,
      reason: "reject",
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectStatusTransitionError && error.code === "not_found",
  );
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(db, {
      prospectId: "not-a-uuid",
      reason: "reject",
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    TypeError,
  );
  await assert.rejects(
    transition(db, {
      prospectId,
      reason: "reject",
      expectedVersion: 0,
      founder,
      correlationId: "correlation-id",
    }),
    TypeError,
  );
  await assert.rejects(
    transition(db, {
      prospectId,
      reason: "reject",
      expectedVersion: 3,
      founder: { email: "founder@example.test", actorId: "not-hex" },
      correlationId: "correlation-id",
    }),
    TypeError,
  );
});
