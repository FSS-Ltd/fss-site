import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createProspectResearchRequester,
  ProspectResearchRequestError,
  type AppendResearchRequestAuditInput,
  type ApplyResearchRequestedInput,
  type CreateResearchRefreshTaskInput,
  type LockedResearchableProspect,
  type ProspectResearchRequestRepository,
  type ProspectResearchRequestTransaction,
} from "./request-research";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const prospectId = "11111111-1111-4111-8111-111111111111";
const researchRunId = "33333333-3333-4333-8333-333333333333";

function lockedProspect(
  overrides: Partial<LockedResearchableProspect> = {},
): LockedResearchableProspect {
  return {
    id: prospectId,
    status: "qualified",
    version: 3,
    researchRunId,
    ...overrides,
  };
}

type FakeState = {
  prospect: LockedResearchableProspect | null;
  createdTasks: CreateResearchRefreshTaskInput[];
  markedRequested: ApplyResearchRequestedInput[];
  audits: AppendResearchRequestAuditInput[];
  existingIdempotentTaskId: string | null;
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    prospect: lockedProspect(),
    createdTasks: [],
    markedRequested: [],
    audits: [],
    existingIdempotentTaskId: null,
    ...overrides,
  };
}

function createFakeRepository(
  state: FakeState,
): ProspectResearchRequestRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: ProspectResearchRequestTransaction) => Promise<T>,
    ) {
      const transaction: ProspectResearchRequestTransaction = {
        async lockProspect(id) {
          if (!state.prospect || state.prospect.id !== id) return null;
          return state.prospect;
        },
        async createResearchRefreshTask(input) {
          state.createdTasks.push(input);
          return {
            agentTaskId: state.existingIdempotentTaskId ?? "44444444-4444-4444-8444-444444444444",
          };
        },
        async markResearchRequested(input) {
          state.markedRequested.push(input);
        },
        async appendResearchRequestAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

const db = {} as GrowthDb;

function createRequester(state: FakeState) {
  return createProspectResearchRequester({
    repository: createFakeRepository(state),
  });
}

test("requests a research refresh and records the agent task, next-action, and audit", async () => {
  const state = createFakeState();
  const request = createRequester(state);

  const result = await request(db, {
    prospectId,
    expectedVersion: 3,
    founder,
    correlationId: "correlation-id",
  });

  assert.equal(result.prospectId, prospectId);
  assert.equal(result.agentTaskId, "44444444-4444-4444-8444-444444444444");
  assert.equal(state.createdTasks.length, 1);
  assert.equal(state.createdTasks[0]?.researchRunId, researchRunId);
  assert.match(
    state.createdTasks[0]?.idempotencyKey ?? "",
    /^research_refresh:.*:v3$/,
  );
  assert.equal(state.markedRequested.length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]?.actorId, founder.actorId);
});

test("rejects a stale version with a conflict error", async () => {
  const state = createFakeState({ prospect: lockedProspect({ version: 5 }) });
  const request = createRequester(state);

  await assert.rejects(
    request(db, {
      prospectId,
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectResearchRequestError &&
      error.code === "version_conflict",
  );
  assert.equal(state.createdTasks.length, 0);
});

test("a terminal prospect cannot have research re-requested", async () => {
  const state = createFakeState({
    prospect: lockedProspect({ status: "rejected", version: 3 }),
  });
  const request = createRequester(state);

  await assert.rejects(
    request(db, {
      prospectId,
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectResearchRequestError &&
      error.code === "already_terminal",
  );
});

test("a prospect with no research run cannot be refreshed", async () => {
  const state = createFakeState({
    prospect: lockedProspect({ researchRunId: null }),
  });
  const request = createRequester(state);

  await assert.rejects(
    request(db, {
      prospectId,
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectResearchRequestError &&
      error.code === "no_research_run",
  );
});

test("rejects an unknown prospect", async () => {
  const state = createFakeState({ prospect: null });
  const request = createRequester(state);

  await assert.rejects(
    request(db, {
      prospectId,
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    (error: unknown) =>
      error instanceof ProspectResearchRequestError && error.code === "not_found",
  );
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const request = createRequester(state);

  await assert.rejects(
    request(db, {
      prospectId: "not-a-uuid",
      expectedVersion: 3,
      founder,
      correlationId: "correlation-id",
    }),
    TypeError,
  );
  await assert.rejects(
    request(db, {
      prospectId,
      expectedVersion: 0,
      founder,
      correlationId: "correlation-id",
    }),
    TypeError,
  );
  await assert.rejects(
    request(db, {
      prospectId,
      expectedVersion: 3,
      founder: { email: "founder@example.test", actorId: "not-hex" },
      correlationId: "correlation-id",
    }),
    TypeError,
  );
});
