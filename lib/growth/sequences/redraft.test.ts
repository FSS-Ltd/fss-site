import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  type CreateRedraftTaskInput,
  createFirstEmailRedrafter,
  FirstEmailRedraftError,
  type FirstEmailRedraftRepository,
  type FirstEmailRedraftTransaction,
  type LockedRedraftDraft,
} from "./redraft";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "b".repeat(64),
};
const optOutSentence = "Reply opt out if you prefer no further emails.";
const conceptDisclaimer =
  "Concept image for discussion only and not a finished design.";

function words(count: number, prefix = "word"): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(
    " ",
  );
}

function email() {
  const text = [words(125), optOutSentence, conceptDisclaimer].join("\n\n");
  return {
    subject: "Draft subject",
    html: `<p>${words(125)}</p><p>${optOutSentence}</p><p>${conceptDisclaimer}</p>`,
    text,
    wordCount: text.split(/\s+/).length,
    optOutSentence,
    conceptDisclaimer,
  };
}

function lockedDraft(
  overrides: Partial<LockedRedraftDraft> = {},
): LockedRedraftDraft {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    prospectId: "22222222-2222-4222-8222-222222222222",
    researchRunId: "66666666-6666-4666-8666-666666666666",
    status: "completed",
    completedAt: new Date("2026-08-17T06:00:00.000Z"),
    hasEnrollment: false,
    outputSnapshot: {
      schemaVersion: "1.0",
      email: email(),
      visual: {
        kind: "fallback",
        fallbackAssetKey: "hospitality",
        pathname: "/growth/email/fallbacks/hospitality.webp",
        sha256: "a".repeat(64),
        altText: "Concept illustration for the reviewed prospect workflow.",
        conceptDisclaimer,
      },
    },
    ...overrides,
  };
}

type FakeState = {
  draft: LockedRedraftDraft | null;
  createdTasks: CreateRedraftTaskInput[];
  audits: Array<{
    correlationId: string;
    actorId: string;
    draftTaskId: string;
  }>;
};

function createFakeRepository(state: FakeState): FirstEmailRedraftRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: FirstEmailRedraftTransaction) => Promise<T>,
    ) {
      const transaction: FirstEmailRedraftTransaction = {
        async lockDraft(draftTaskId) {
          if (!state.draft || state.draft.id !== draftTaskId) return null;
          return state.draft;
        },
        async createRedraftTask(input) {
          state.createdTasks.push(input);
          return { redraftTaskId: "redraft-task-id" };
        },
        async appendRedraftAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

const db = {} as GrowthDb;
const baseInput = {
  draftTaskId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 1,
  founder,
  correlationId: "correlation-id",
  reason: "The offer needs to reference their new service line.",
};

test("requests a redraft for a ready draft and audits it", async () => {
  const state: FakeState = {
    draft: lockedDraft(),
    createdTasks: [],
    audits: [],
  };
  const requestRedraft = createFirstEmailRedrafter({
    repository: createFakeRepository(state),
  });

  const result = await requestRedraft(db, baseInput);

  assert.equal(result.redraftTaskId, "redraft-task-id");
  assert.equal(state.createdTasks.length, 1);
  const created = state.createdTasks[0]!;
  assert.equal(created.researchRunId, "66666666-6666-4666-8666-666666666666");
  assert.equal(created.prospectId, "22222222-2222-4222-8222-222222222222");
  assert.equal(
    created.reason,
    "The offer needs to reference their new service line.",
  );
  assert.equal(state.audits.length, 1);
});

test("rejects an unknown draft", async () => {
  const state: FakeState = { draft: null, createdTasks: [], audits: [] };
  const requestRedraft = createFirstEmailRedrafter({
    repository: createFakeRepository(state),
  });

  await assert.rejects(
    requestRedraft(db, baseInput),
    (error: unknown) =>
      error instanceof FirstEmailRedraftError && error.code === "not_found",
  );
});

test("rejects a draft that is not ready, already approved, or already enrolled", async () => {
  const fallbackVisual = {
    kind: "fallback",
    fallbackAssetKey: "hospitality",
    pathname: "/growth/email/fallbacks/hospitality.webp",
    sha256: "a".repeat(64),
    altText: "Concept illustration for the reviewed prospect workflow.",
    conceptDisclaimer,
  };
  const notCompleted: FakeState = {
    draft: lockedDraft({ status: "processing" }),
    createdTasks: [],
    audits: [],
  };
  const alreadyApproved: FakeState = {
    draft: lockedDraft({
      outputSnapshot: {
        schemaVersion: "1.0",
        email: email(),
        visual: fallbackVisual,
        reviewState: "approved",
      },
    }),
    createdTasks: [],
    audits: [],
  };
  const alreadyEnrolled: FakeState = {
    draft: lockedDraft({ hasEnrollment: true }),
    createdTasks: [],
    audits: [],
  };

  for (const state of [notCompleted, alreadyApproved, alreadyEnrolled]) {
    const requestRedraft = createFirstEmailRedrafter({
      repository: createFakeRepository(state),
    });
    await assert.rejects(
      requestRedraft(db, baseInput),
      (error: unknown) =>
        error instanceof FirstEmailRedraftError &&
        error.code === "not_redraftable",
    );
  }
});

test("rejects a stale expected version", async () => {
  const state: FakeState = {
    draft: lockedDraft(),
    createdTasks: [],
    audits: [],
  };
  const requestRedraft = createFirstEmailRedrafter({
    repository: createFakeRepository(state),
  });

  await assert.rejects(
    requestRedraft(db, { ...baseInput, expectedVersion: 2 }),
    (error: unknown) =>
      error instanceof FirstEmailRedraftError &&
      error.code === "version_conflict",
  );
});

test("rejects malformed request input", async () => {
  const state: FakeState = {
    draft: lockedDraft(),
    createdTasks: [],
    audits: [],
  };
  const requestRedraft = createFirstEmailRedrafter({
    repository: createFakeRepository(state),
  });

  await assert.rejects(
    requestRedraft(db, { ...baseInput, draftTaskId: "not-a-uuid" }),
    TypeError,
  );
  await assert.rejects(
    requestRedraft(db, { ...baseInput, reason: "too short" }),
    TypeError,
  );
  await assert.rejects(
    requestRedraft(db, {
      ...baseInput,
      founder: { email: "founder@example.test", actorId: "not-hex" },
    }),
    TypeError,
  );
});
