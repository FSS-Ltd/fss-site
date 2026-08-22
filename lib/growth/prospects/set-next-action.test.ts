import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createNextActionSetter,
  SetNextActionError,
  type AppendNextActionAuditInput,
  type ApplyNextActionInput,
  type LockedNextActionProspect,
  type SetNextActionRepository,
  type SetNextActionTransaction,
} from "./set-next-action";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const prospectId = "11111111-1111-4111-8111-111111111111";
const db = {} as GrowthDb;

function lockedProspect(
  overrides: Partial<LockedNextActionProspect> = {},
): LockedNextActionProspect {
  return {
    id: prospectId,
    status: "qualified",
    version: 3,
    nextAction: null,
    nextActionDueAt: null,
    ...overrides,
  };
}

type FakeState = {
  prospect: LockedNextActionProspect | null;
  applied: ApplyNextActionInput[];
  audits: AppendNextActionAuditInput[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return { prospect: lockedProspect(), applied: [], audits: [], ...overrides };
}

function createFakeRepository(state: FakeState): SetNextActionRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: SetNextActionTransaction) => Promise<T>,
    ) {
      const transaction: SetNextActionTransaction = {
        async lockProspect(id) {
          if (!state.prospect || state.prospect.id !== id) return null;
          return state.prospect;
        },
        async applyNextAction(input) {
          state.applied.push(input);
          if (state.prospect) {
            state.prospect.nextAction = input.nextAction;
            state.prospect.nextActionDueAt = input.nextActionDueAt.toISOString();
            state.prospect.version += 1;
          }
        },
        async appendNextActionAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

function createSetter(state: FakeState) {
  return createNextActionSetter({ repository: createFakeRepository(state) });
}

test("sets the next action and due date, and appends an audit event", async () => {
  const state = createFakeState();
  const setter = createSetter(state);

  const result = await setter(db, {
    prospectId,
    expectedVersion: 3,
    nextAction: "Send proposal",
    nextActionDueAt: "2026-08-25T09:00:00.000Z",
    founder,
    correlationId: "correlation-1",
  });

  assert.equal(result.nextAction, "Send proposal");
  assert.equal(result.nextActionDueAt, "2026-08-25T09:00:00.000Z");
  assert.equal(state.applied.length, 1);
  assert.equal(state.applied[0]?.nextAction, "Send proposal");
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]?.prospectId, prospectId);
});

test("overwrites whatever next action was set before", async () => {
  const state = createFakeState({
    prospect: lockedProspect({ nextAction: "Old step", nextActionDueAt: "2026-08-01T09:00:00.000Z" }),
  });
  const setter = createSetter(state);

  await setter(db, {
    prospectId,
    expectedVersion: 3,
    nextAction: "New step",
    nextActionDueAt: "2026-08-25T09:00:00.000Z",
    founder,
    correlationId: "c",
  });

  assert.equal(state.prospect?.nextAction, "New step");
});

test("rejects a stale version with a conflict error", async () => {
  const state = createFakeState({ prospect: lockedProspect({ version: 5 }) });
  const setter = createSetter(state);

  await assert.rejects(
    setter(db, {
      prospectId,
      expectedVersion: 3,
      nextAction: "Send proposal",
      nextActionDueAt: "2026-08-25T09:00:00.000Z",
      founder,
      correlationId: "c",
    }),
    (error: unknown) =>
      error instanceof SetNextActionError && error.code === "version_conflict",
  );
  assert.equal(state.applied.length, 0);
});

test("rejects an unknown prospect", async () => {
  const state = createFakeState({ prospect: null });
  const setter = createSetter(state);

  await assert.rejects(
    setter(db, {
      prospectId,
      expectedVersion: 3,
      nextAction: "Send proposal",
      nextActionDueAt: "2026-08-25T09:00:00.000Z",
      founder,
      correlationId: "c",
    }),
    (error: unknown) =>
      error instanceof SetNextActionError && error.code === "not_found",
  );
});

test("rejects an empty next action", async () => {
  const state = createFakeState();
  const setter = createSetter(state);

  await assert.rejects(
    setter(db, {
      prospectId,
      expectedVersion: 3,
      nextAction: "   ",
      nextActionDueAt: "2026-08-25T09:00:00.000Z",
      founder,
      correlationId: "c",
    }),
    TypeError,
  );
});

test("rejects a next action over the length limit", async () => {
  const state = createFakeState();
  const setter = createSetter(state);

  await assert.rejects(
    setter(db, {
      prospectId,
      expectedVersion: 3,
      nextAction: "x".repeat(301),
      nextActionDueAt: "2026-08-25T09:00:00.000Z",
      founder,
      correlationId: "c",
    }),
    TypeError,
  );
});

test("rejects a due date without an explicit offset", async () => {
  const state = createFakeState();
  const setter = createSetter(state);

  await assert.rejects(
    setter(db, {
      prospectId,
      expectedVersion: 3,
      nextAction: "Send proposal",
      nextActionDueAt: "2026-08-25",
      founder,
      correlationId: "c",
    }),
    TypeError,
  );
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const setter = createSetter(state);

  await assert.rejects(
    setter(db, {
      prospectId: "not-a-uuid",
      expectedVersion: 3,
      nextAction: "Send proposal",
      nextActionDueAt: "2026-08-25T09:00:00.000Z",
      founder,
      correlationId: "c",
    }),
    TypeError,
  );
  await assert.rejects(
    setter(db, {
      prospectId,
      expectedVersion: 3,
      nextAction: "Send proposal",
      nextActionDueAt: "2026-08-25T09:00:00.000Z",
      founder: { email: "founder@example.test", actorId: "not-hex" },
      correlationId: "c",
    }),
    TypeError,
  );
});
