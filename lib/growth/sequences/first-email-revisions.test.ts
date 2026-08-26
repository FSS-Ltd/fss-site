import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import type { FounderSession } from "../auth/require-founder";
import { parseStoredFirstEmailDraft } from "./first-email-draft-snapshot";
import {
  createFirstEmailDraftReviser,
  FirstEmailRevisionError,
  type FirstEmailRevisionRepository,
  type StoredFirstEmailDraft,
} from "./first-email-revisions";

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

function email(subject = "Original subject") {
  const text = [words(125), optOutSentence, conceptDisclaimer].join("\n\n");
  return {
    subject,
    html: `<p>${words(125)}</p><p>${optOutSentence}</p><p>${conceptDisclaimer}</p>`,
    text,
    wordCount: text.split(/\s+/).length,
    optOutSentence,
    conceptDisclaimer,
  };
}

function storedDraft(
  overrides: Partial<StoredFirstEmailDraft> = {},
): StoredFirstEmailDraft {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    prospectId: "22222222-2222-4222-8222-222222222222",
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

function createRepository(initialDraft: StoredFirstEmailDraft | null) {
  let draft = initialDraft;
  const savedSnapshots: unknown[] = [];
  const audits: unknown[] = [];
  const repository: FirstEmailRevisionRepository = {
    async withTransaction(_db, operation) {
      return operation({
        async lockDraft() {
          return draft;
        },
        async saveDraftRevision(input) {
          savedSnapshots.push(input.outputSnapshot);
          if (draft) {
            draft = { ...draft, outputSnapshot: input.outputSnapshot };
          }
        },
        async appendRevisionAudit(input) {
          audits.push(input);
        },
      });
    },
  };
  return { repository, savedSnapshots, audits, readDraft: () => draft };
}

function revisionInput(expectedVersion = 1) {
  return {
    draftTaskId: "11111111-1111-4111-8111-111111111111",
    expectedVersion,
    founder,
    correlationId: "revision-correlation-id",
    subject: "Founder revised subject",
    paragraphs: [words(125, "revised"), optOutSentence, conceptDisclaimer],
  };
}

test("stores a founder revision while preserving the agent draft and visual", async () => {
  const fake = createRepository(storedDraft());
  const revise = createFirstEmailDraftReviser({
    repository: fake.repository,
    now: () => new Date("2026-08-17T12:00:00.000Z"),
  });

  const result = await revise({} as GrowthDb, revisionInput());

  assert.equal(result.version, 2);
  assert.equal(result.email.subject, "Founder revised subject");
  assert.equal(result.editedAt, "2026-08-17T12:00:00.000Z");
  assert.equal(fake.savedSnapshots.length, 1);
  const saved = fake.savedSnapshots[0] as Record<string, unknown>;
  assert.equal(saved.draftVersion, 2);
  assert.equal(saved.reviewState, "draft");
  assert.deepEqual(
    saved.visual,
    (storedDraft().outputSnapshot as Record<string, unknown>).visual,
  );
  const revisions = saved.emailRevisions as Array<Record<string, unknown>>;
  assert.equal(revisions.length, 2);
  assert.deepEqual(revisions[0], {
    version: 1,
    source: "agent",
    editorActorId: "weekday-agent-v1",
    editedAt: "2026-08-17T06:00:00.000Z",
    email: email(),
  });
  assert.deepEqual(revisions[1], {
    version: 2,
    source: "founder",
    editorActorId: founder.actorId,
    editedAt: "2026-08-17T12:00:00.000Z",
    email: result.email,
  });
  assert.deepEqual(fake.audits, [
    {
      correlationId: "revision-correlation-id",
      actorId: founder.actorId,
      draftTaskId: revisionInput().draftTaskId,
    },
  ]);
});

test("parses a system revision created by prospect preview approval", () => {
  const originalEmail = email();
  const systemEmail = email("Preview concept email");
  const draft = storedDraft({
    outputSnapshot: {
      ...(storedDraft().outputSnapshot as Record<string, unknown>),
      email: systemEmail,
      reviewState: "draft",
      draftVersion: 2,
      emailRevisions: [
        {
          version: 1,
          source: "agent",
          editorActorId: "weekday-agent-v1",
          editedAt: "2026-08-17T06:00:00.000Z",
          email: originalEmail,
        },
        {
          version: 2,
          source: "system",
          editorActorId: "prospect-preview-approval",
          editedAt: "2026-08-17T12:00:00.000Z",
          email: systemEmail,
        },
      ],
    },
  });

  const parsed = parseStoredFirstEmailDraft(draft);

  assert.equal(parsed.version, 2);
  assert.equal(parsed.revisions[1]?.source, "system");
  assert.equal(parsed.email.subject, "Preview concept email");
});

test("appends later revisions without losing either earlier version", async () => {
  const fake = createRepository(storedDraft());
  let instant = "2026-08-17T12:00:00.000Z";
  const revise = createFirstEmailDraftReviser({
    repository: fake.repository,
    now: () => new Date(instant),
  });

  await revise({} as GrowthDb, revisionInput());
  instant = "2026-08-17T12:30:00.000Z";
  const result = await revise({} as GrowthDb, {
    ...revisionInput(2),
    subject: "Second founder revision",
  });

  assert.equal(result.version, 3);
  const saved = fake.savedSnapshots[1] as Record<string, unknown>;
  const revisions = saved.emailRevisions as Array<Record<string, unknown>>;
  assert.deepEqual(
    revisions.map((revision) => revision.version),
    [1, 2, 3],
  );
  assert.deepEqual(
    revisions.map((revision) => revision.source),
    ["agent", "founder", "founder"],
  );
});

test("rejects stale versions before saving or auditing", async () => {
  const fake = createRepository(storedDraft());
  const revise = createFirstEmailDraftReviser({ repository: fake.repository });

  await assert.rejects(revise({} as GrowthDb, revisionInput(2)), (error) => {
    assert.ok(error instanceof FirstEmailRevisionError);
    assert.equal(error.code, "version_conflict");
    return true;
  });
  assert.equal(fake.savedSnapshots.length, 0);
  assert.equal(fake.audits.length, 0);
});

test("rejects missing, inactive, approved, or materialised drafts", async () => {
  const cases: Array<[StoredFirstEmailDraft | null, string]> = [
    [null, "not_found"],
    [storedDraft({ status: "paused" }), "not_editable"],
    [
      storedDraft({
        outputSnapshot: {
          ...(storedDraft().outputSnapshot as Record<string, unknown>),
          reviewState: "approved",
        },
      }),
      "not_editable",
    ],
    [
      storedDraft({
        outputSnapshot: {
          ...(storedDraft().outputSnapshot as Record<string, unknown>),
          reviewState: "provider_draft",
        },
      }),
      "not_editable",
    ],
    [storedDraft({ hasEnrollment: true }), "not_editable"],
  ];

  for (const [draft, expectedCode] of cases) {
    const fake = createRepository(draft);
    const revise = createFirstEmailDraftReviser({
      repository: fake.repository,
    });
    await assert.rejects(revise({} as GrowthDb, revisionInput()), (error) => {
      assert.ok(error instanceof FirstEmailRevisionError);
      assert.equal(error.code, expectedCode);
      return true;
    });
    assert.equal(fake.savedSnapshots.length, 0);
  }
});

test("retains stored standards and rejects malformed revision content", async () => {
  const fake = createRepository(storedDraft());
  const revise = createFirstEmailDraftReviser({ repository: fake.repository });

  await assert.rejects(
    revise({} as GrowthDb, {
      ...revisionInput(),
      paragraphs: [words(135), conceptDisclaimer],
    }),
    /opt-out/i,
  );
  assert.equal(fake.savedSnapshots.length, 0);
  assert.equal(fake.audits.length, 0);
});

test("fails closed on malformed stored revision state", async () => {
  const baseSnapshot = storedDraft().outputSnapshot as Record<string, unknown>;
  const malformedSnapshots = [
    { ...baseSnapshot, email: { ...email(), wordCount: 999 } },
    { ...baseSnapshot, visual: {} },
    {
      ...baseSnapshot,
      visual: {
        ...(baseSnapshot.visual as Record<string, unknown>),
        conceptDisclaimer: "A different compliance disclaimer.",
      },
    },
  ];

  for (const outputSnapshot of malformedSnapshots) {
    const fake = createRepository(storedDraft({ outputSnapshot }));
    const revise = createFirstEmailDraftReviser({
      repository: fake.repository,
    });

    await assert.rejects(revise({} as GrowthDb, revisionInput()), (error) => {
      assert.ok(error instanceof FirstEmailRevisionError);
      assert.equal(error.code, "invalid_stored_draft");
      return true;
    });
    assert.equal(fake.savedSnapshots.length, 0);
  }
});

test("rejects actor identifiers that could persist founder PII", async () => {
  const fake = createRepository(storedDraft());
  const revise = createFirstEmailDraftReviser({ repository: fake.repository });

  await assert.rejects(
    revise({} as GrowthDb, {
      ...revisionInput(),
      founder: { ...founder, actorId: "founder@example.test" },
    }),
    TypeError,
  );
  assert.equal(fake.savedSnapshots.length, 0);
  assert.equal(fake.audits.length, 0);
});

test("bounds revision history before the JSON snapshot can grow indefinitely", async () => {
  const currentEmail = email();
  const fake = createRepository(
    storedDraft({
      outputSnapshot: {
        schemaVersion: "1.0",
        email: currentEmail,
        visual: (storedDraft().outputSnapshot as Record<string, unknown>)
          .visual,
        reviewState: "draft",
        draftVersion: 100,
        emailRevisions: Array.from({ length: 100 }, (_, index) => ({
          version: index + 1,
          source: index === 0 ? "agent" : "founder",
          editorActorId: index === 0 ? "weekday-agent-v1" : founder.actorId,
          editedAt: "2026-08-17T12:00:00.000Z",
          email: currentEmail,
        })),
      },
    }),
  );
  const revise = createFirstEmailDraftReviser({ repository: fake.repository });

  await assert.rejects(revise({} as GrowthDb, revisionInput(100)), (error) => {
    assert.ok(error instanceof FirstEmailRevisionError);
    assert.equal(error.code, "revision_limit_reached");
    return true;
  });
  assert.equal(fake.savedSnapshots.length, 0);
});
