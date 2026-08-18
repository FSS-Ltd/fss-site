import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import type { GmailClient } from "../integrations/gmail/types";
import {
  type ApprovedVisualAsset,
  type CreateEnrollmentAndMessageInput,
  createFirstEmailApprover,
  FirstEmailApprovalError,
  type FirstEmailApprovalRepository,
  type FirstEmailApprovalTransaction,
  type LockedApprovalDraft,
} from "./approval";

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
    subject: "Approved subject",
    html: `<p>${words(125)}</p><p>${optOutSentence}</p><p>${conceptDisclaimer}</p>`,
    text,
    wordCount: text.split(/\s+/).length,
    optOutSentence,
    conceptDisclaimer,
  };
}

function fallbackVisual() {
  return {
    kind: "fallback" as const,
    fallbackAssetKey: "hospitality",
    pathname: "/growth/email/fallbacks/hospitality.webp",
    sha256: "a".repeat(64),
    altText: "Concept illustration for the reviewed prospect workflow.",
    conceptDisclaimer,
  };
}

function storedVisual() {
  return {
    kind: "stored" as const,
    assetId: "44444444-4444-4444-8444-444444444444",
    altText: "Concept illustration for the reviewed prospect workflow.",
    conceptDisclaimer,
  };
}

function lockedDraft(
  overrides: Partial<LockedApprovalDraft> = {},
): LockedApprovalDraft {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    prospectId: "22222222-2222-4222-8222-222222222222",
    contactId: "33333333-3333-4333-8333-333333333333",
    contactEmail: "contact@example.test",
    normalisedEmail: "contact@example.test",
    subscriberType: "corporate",
    corporateStatus: "active",
    status: "completed",
    completedAt: new Date("2026-08-17T06:00:00.000Z"),
    hasEnrollment: false,
    outputSnapshot: {
      schemaVersion: "1.0",
      email: email(),
      visual: fallbackVisual(),
    },
    ...overrides,
  };
}

type FakeState = {
  draft: LockedApprovalDraft | null;
  suppressed: Set<string>;
  assets: Map<string, ApprovedVisualAsset>;
  enrollments: CreateEnrollmentAndMessageInput[];
  reviewStateUpdates: Array<{
    draftTaskId: string;
    outputSnapshot: Record<string, unknown>;
  }>;
  audits: Array<{
    correlationId: string;
    actorId: string;
    draftTaskId: string;
  }>;
  providerDrafts: Array<{
    messageId: string;
    providerDraftId: string;
    providerThreadId: string;
  }>;
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    draft: lockedDraft(),
    suppressed: new Set(),
    assets: new Map(),
    enrollments: [],
    reviewStateUpdates: [],
    audits: [],
    providerDrafts: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): FirstEmailApprovalRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: FirstEmailApprovalTransaction) => Promise<T>,
    ) {
      const transaction: FirstEmailApprovalTransaction = {
        async lockDraft(draftTaskId) {
          if (!state.draft || state.draft.id !== draftTaskId) return null;
          return state.draft;
        },
        async isSuppressed(normalisedEmail) {
          return state.suppressed.has(normalisedEmail);
        },
        async getApprovedAsset(assetId) {
          return state.assets.get(assetId) ?? null;
        },
        async createEnrollmentAndFirstMessage(input) {
          state.enrollments.push(input);
          return { sequenceEnrollmentId: "enrollment-id" };
        },
        async markDraftReviewState(draftTaskId, outputSnapshot) {
          state.reviewStateUpdates.push({ draftTaskId, outputSnapshot });
        },
        async appendApprovalAudit(input) {
          state.audits.push(input);
        },
      };
      return operation(transaction);
    },
    async recordProviderDraft(_db, input) {
      state.providerDrafts.push(input);
    },
  };
}

function fakeGmailClient(
  overrides: Partial<Pick<GmailClient, "createDraft">> = {},
): Pick<GmailClient, "createDraft"> {
  return {
    createDraft:
      overrides.createDraft ??
      (async () => ({
        draftId: "provider-draft-1",
        messageId: "provider-message-1",
        gmailThreadId: "provider-thread-1",
      })),
  };
}

function createApprover(
  state: FakeState,
  overrides: {
    gmailClient?: Pick<GmailClient, "createDraft">;
  } = {},
) {
  return createFirstEmailApprover({
    repository: createFakeRepository(state),
    gmailClient: overrides.gmailClient ?? fakeGmailClient(),
    founderEmail: "j.ntagengwa@faithfulsoftware.dev",
    siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
    now: () => new Date("2026-08-18T09:00:00.000Z"),
    createMessageId: () => "55555555-5555-4555-8555-555555555555",
  });
}

const db = {} as GrowthDb;
const baseInput = {
  draftTaskId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 1,
  founder,
  correlationId: "correlation-id",
} as const;

test("approves a ready draft in queue mode and stores an immutable snapshot", async () => {
  const state = createFakeState();
  const approve = createApprover(state);

  const result = await approve(db, { ...baseInput, sendMode: "queue" });

  assert.equal(result.status, "queued");
  assert.equal(result.sequenceEnrollmentId, "enrollment-id");
  assert.equal(state.enrollments.length, 1);
  const enrollment = state.enrollments[0]!;
  assert.equal(enrollment.enrollmentStatus, "active");
  assert.equal(enrollment.message.status, "queued");
  assert.deepEqual(
    enrollment.message.scheduledFor,
    new Date("2026-08-18T09:00:00.000Z"),
  );
  assert.equal(enrollment.message.emailAssetId, null);
  assert.equal(
    state.reviewStateUpdates[0]?.outputSnapshot.reviewState,
    "approved",
  );
  assert.equal(state.audits.length, 1);
  assert.equal(state.providerDrafts.length, 0);
});

test("creates a Gmail draft and leaves the sequence pending manual send", async () => {
  const state = createFakeState();
  const approve = createApprover(state);

  const result = await approve(db, { ...baseInput, sendMode: "gmail_draft" });

  assert.equal(result.status, "provider_draft");
  const enrollment = state.enrollments[0]!;
  assert.equal(enrollment.enrollmentStatus, "pending_approval");
  assert.equal(enrollment.message.status, "draft");
  assert.equal(enrollment.message.scheduledFor, null);
  assert.equal(
    state.reviewStateUpdates[0]?.outputSnapshot.reviewState,
    "provider_draft",
  );
  assert.deepEqual(state.providerDrafts, [
    {
      messageId: "55555555-5555-4555-8555-555555555555",
      providerDraftId: "provider-draft-1",
      providerThreadId: "provider-thread-1",
    },
  ]);
});

test("surfaces a Gmail draft failure without losing the already-committed enrollment", async () => {
  const state = createFakeState();
  const approve = createApprover(state, {
    gmailClient: fakeGmailClient({
      createDraft: async () => {
        throw new Error("network error");
      },
    }),
  });

  await assert.rejects(
    approve(db, { ...baseInput, sendMode: "gmail_draft" }),
    (error: unknown) =>
      error instanceof FirstEmailApprovalError &&
      error.code === "gmail_draft_failed",
  );
  assert.equal(state.enrollments.length, 1);
  assert.equal(state.providerDrafts.length, 0);
});

test("rejects an unknown draft", async () => {
  const state = createFakeState({ draft: null });
  const approve = createApprover(state);

  await assert.rejects(
    approve(db, { ...baseInput, sendMode: "queue" }),
    (error: unknown) =>
      error instanceof FirstEmailApprovalError && error.code === "not_found",
  );
});

test("rejects a draft that is not ready, already reviewed, or already enrolled", async () => {
  const notCompleted = createFakeState({
    draft: lockedDraft({ status: "processing" }),
  });
  const alreadyApproved = createFakeState({
    draft: lockedDraft({
      outputSnapshot: {
        schemaVersion: "1.0",
        email: email(),
        visual: fallbackVisual(),
        reviewState: "approved",
      },
    }),
  });
  const alreadyEnrolled = createFakeState({
    draft: lockedDraft({ hasEnrollment: true }),
  });

  for (const state of [notCompleted, alreadyApproved, alreadyEnrolled]) {
    const approve = createApprover(state);
    await assert.rejects(
      approve(db, { ...baseInput, sendMode: "queue" }),
      (error: unknown) =>
        error instanceof FirstEmailApprovalError &&
        error.code === "not_approvable",
    );
  }
});

test("rejects a stale expected version", async () => {
  const state = createFakeState();
  const approve = createApprover(state);

  await assert.rejects(
    approve(db, { ...baseInput, expectedVersion: 2, sendMode: "queue" }),
    (error: unknown) =>
      error instanceof FirstEmailApprovalError &&
      error.code === "version_conflict",
  );
});

test("rejects a suppressed contact", async () => {
  const state = createFakeState({
    suppressed: new Set(["contact@example.test"]),
  });
  const approve = createApprover(state);

  await assert.rejects(
    approve(db, { ...baseInput, sendMode: "queue" }),
    (error: unknown) =>
      error instanceof FirstEmailApprovalError &&
      error.code === "suppressed_contact",
  );
});

test("rejects a non-corporate contact or an inactive business", async () => {
  const individual = createFakeState({
    draft: lockedDraft({ subscriberType: "individual" }),
  });
  const inactiveBusiness = createFakeState({
    draft: lockedDraft({ corporateStatus: "inactive" }),
  });

  for (const state of [individual, inactiveBusiness]) {
    const approve = createApprover(state);
    await assert.rejects(
      approve(db, { ...baseInput, sendMode: "queue" }),
      (error: unknown) =>
        error instanceof FirstEmailApprovalError &&
        error.code === "non_corporate_contact",
    );
  }
});

test("rejects a stored visual that is missing or not approved", async () => {
  const missingAsset = createFakeState({
    draft: lockedDraft({
      outputSnapshot: {
        schemaVersion: "1.0",
        email: email(),
        visual: storedVisual(),
      },
    }),
  });
  const pendingAsset = createFakeState({
    draft: lockedDraft({
      outputSnapshot: {
        schemaVersion: "1.0",
        email: email(),
        visual: storedVisual(),
      },
    }),
    assets: new Map([
      [
        "44444444-4444-4444-8444-444444444444",
        {
          url: "https://asset.public.blob.vercel-storage.com/growth-email-assets/44444444-4444-4444-8444-444444444444.webp",
          width: 1200,
          height: 630,
          byteSize: 100_000,
          altText: "Concept illustration for the reviewed prospect workflow.",
          reviewStatus: "pending",
        },
      ],
    ]),
  });

  for (const state of [missingAsset, pendingAsset]) {
    const approve = createApprover(state);
    await assert.rejects(
      approve(db, { ...baseInput, sendMode: "queue" }),
      (error: unknown) =>
        error instanceof FirstEmailApprovalError &&
        error.code === "unapproved_visual",
    );
  }
});

test("approves an approved stored visual and links its asset ID", async () => {
  const state = createFakeState({
    draft: lockedDraft({
      outputSnapshot: {
        schemaVersion: "1.0",
        email: email(),
        visual: storedVisual(),
      },
    }),
    assets: new Map([
      [
        "44444444-4444-4444-8444-444444444444",
        {
          url: "https://asset.public.blob.vercel-storage.com/growth-email-assets/44444444-4444-4444-8444-444444444444.webp",
          width: 1200,
          height: 630,
          byteSize: 100_000,
          altText: "Concept illustration for the reviewed prospect workflow.",
          reviewStatus: "approved",
        },
      ],
    ]),
  });
  const approve = createApprover(state);

  await approve(db, { ...baseInput, sendMode: "queue" });

  assert.equal(
    state.enrollments[0]?.message.emailAssetId,
    "44444444-4444-4444-8444-444444444444",
  );
});

test("fails closed on a malformed stored draft", async () => {
  const state = createFakeState({
    draft: lockedDraft({
      outputSnapshot: { schemaVersion: "1.0", email: email() },
    }),
  });
  const approve = createApprover(state);

  await assert.rejects(
    approve(db, { ...baseInput, sendMode: "queue" }),
    (error: unknown) =>
      error instanceof FirstEmailApprovalError &&
      error.code === "invalid_stored_draft",
  );
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const approve = createApprover(state);

  await assert.rejects(
    approve(db, { ...baseInput, draftTaskId: "not-a-uuid", sendMode: "queue" }),
    TypeError,
  );
  await assert.rejects(
    approve(db, {
      ...baseInput,
      founder: { email: "founder@example.test", actorId: "not-hex" },
      sendMode: "queue",
    }),
    TypeError,
  );
  await assert.rejects(
    approve(db, {
      ...baseInput,
      sendMode: "invalid" as unknown as "queue",
    }),
    TypeError,
  );
});
