import { z } from "zod";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { parseFirstEmailCandidate } from "../research/ingestion-schema";
import type { FirstEmailCandidate } from "../research/types";
import { createFounderFirstEmailRevision } from "./edit-first-email";
import { postgresFirstEmailRevisionRepository } from "./first-email-revision-repository";

const MAX_DRAFT_REVISIONS = 100;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

function exactText(min: number, max: number) {
  return z
    .string()
    .min(min)
    .max(max)
    .refine((value) => value === value.trim());
}

const storedVisualSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("fallback"),
      fallbackAssetKey: exactText(1, 120),
      pathname: z.string().startsWith("/growth/email/fallbacks/"),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      altText: exactText(20, 1000),
      conceptDisclaimer: exactText(1, 500),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal("stored"),
      assetId: z.uuid(),
      altText: exactText(20, 1000),
      conceptDisclaimer: exactText(1, 500),
    })
    .passthrough(),
]);

const revisionRecordSchema = z.discriminatedUnion("source", [
  z
    .object({
      version: z.number().int().positive(),
      source: z.literal("agent"),
      editorActorId: exactText(1, 200),
      editedAt: z.iso.datetime({ offset: true }),
      email: z.unknown(),
    })
    .strict(),
  z
    .object({
      version: z.number().int().positive(),
      source: z.literal("founder"),
      editorActorId: z.string().regex(FOUNDER_ACTOR_ID_PATTERN),
      editedAt: z.iso.datetime({ offset: true }),
      email: z.unknown(),
    })
    .strict(),
]);

const storedOutputSnapshotSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    email: z.unknown(),
    visual: storedVisualSchema,
    reviewState: z.enum(["draft", "approved", "provider_draft"]).optional(),
    draftVersion: z.number().int().positive().optional(),
    emailRevisions: z
      .array(revisionRecordSchema)
      .max(MAX_DRAFT_REVISIONS)
      .optional(),
  })
  .passthrough();

type RevisionRecord = {
  version: number;
  source: "agent" | "founder";
  editorActorId: string;
  editedAt: string;
  email: FirstEmailCandidate;
};

type ParsedDraftSnapshot = {
  snapshot: Record<string, unknown>;
  email: FirstEmailCandidate;
  reviewState: "draft" | "approved" | "provider_draft";
  version: number;
  revisions: RevisionRecord[];
};

export type StoredFirstEmailDraft = {
  id: string;
  prospectId: string;
  status: string;
  outputSnapshot: unknown;
  completedAt: Date | null;
  hasEnrollment: boolean;
};

export type SaveFirstEmailDraftRevisionInput = {
  draftTaskId: string;
  outputSnapshot: Record<string, unknown>;
};

export type AppendFirstEmailRevisionAuditInput = {
  correlationId: string;
  actorId: string;
  draftTaskId: string;
};

export interface FirstEmailRevisionTransaction {
  lockDraft(draftTaskId: string): Promise<StoredFirstEmailDraft | null>;
  saveDraftRevision(input: SaveFirstEmailDraftRevisionInput): Promise<void>;
  appendRevisionAudit(input: AppendFirstEmailRevisionAuditInput): Promise<void>;
}

export interface FirstEmailRevisionRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: FirstEmailRevisionTransaction) => Promise<T>,
  ): Promise<T>;
}

export type ReviseFirstEmailDraftInput = {
  draftTaskId: string;
  expectedVersion: number;
  founder: FounderSession;
  correlationId: string;
  subject: string;
  paragraphs: readonly string[];
};

export type FounderFirstEmailRevision = {
  draftTaskId: string;
  version: number;
  editedAt: string;
  email: FirstEmailCandidate;
};

export type FirstEmailRevisionErrorCode =
  | "not_found"
  | "not_editable"
  | "version_conflict"
  | "revision_limit_reached"
  | "invalid_stored_draft";

export class FirstEmailRevisionError extends Error {
  constructor(readonly code: FirstEmailRevisionErrorCode) {
    super("The first-email draft could not be revised.");
    this.name = "FirstEmailRevisionError";
  }
}

function sameEmail(
  left: FirstEmailCandidate,
  right: FirstEmailCandidate,
): boolean {
  return (
    left.subject === right.subject &&
    left.html === right.html &&
    left.text === right.text &&
    left.wordCount === right.wordCount &&
    left.optOutSentence === right.optOutSentence &&
    left.conceptDisclaimer === right.conceptDisclaimer
  );
}

function parseStoredDraft(draft: StoredFirstEmailDraft): ParsedDraftSnapshot {
  try {
    const snapshot = storedOutputSnapshotSchema.parse(draft.outputSnapshot);
    const currentEmail = parseFirstEmailCandidate(snapshot.email);
    const reviewState = snapshot.reviewState ?? "draft";
    if (snapshot.visual.conceptDisclaimer !== currentEmail.conceptDisclaimer) {
      throw new Error("Visual disclaimer does not match the email.");
    }

    if (
      snapshot.draftVersion === undefined &&
      snapshot.emailRevisions === undefined
    ) {
      if (!draft.completedAt) throw new Error("Missing initial revision time.");
      return {
        snapshot,
        email: currentEmail,
        reviewState,
        version: 1,
        revisions: [
          {
            version: 1,
            source: "agent",
            editorActorId: "weekday-agent-v1",
            editedAt: draft.completedAt.toISOString(),
            email: currentEmail,
          },
        ],
      };
    }

    if (
      snapshot.draftVersion === undefined ||
      snapshot.emailRevisions === undefined ||
      snapshot.emailRevisions.length !== snapshot.draftVersion
    ) {
      throw new Error("Incomplete revision history.");
    }
    const revisions = snapshot.emailRevisions.map((record, index) => ({
      ...record,
      email: parseFirstEmailCandidate(record.email),
      version: index + 1,
    }));
    if (
      snapshot.emailRevisions.some(
        (record, index) => record.version !== index + 1,
      ) ||
      !sameEmail(revisions.at(-1)!.email, currentEmail)
    ) {
      throw new Error("Inconsistent revision history.");
    }
    return {
      snapshot,
      email: currentEmail,
      reviewState,
      version: snapshot.draftVersion,
      revisions,
    };
  } catch {
    throw new FirstEmailRevisionError("invalid_stored_draft");
  }
}

function validateRequest(input: ReviseFirstEmailDraftInput): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.draftTaskId,
    ) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId)
  ) {
    throw new TypeError("First-email revision request is invalid.");
  }
}

type FirstEmailDraftReviserDependencies = {
  repository: FirstEmailRevisionRepository;
  now?: () => Date;
};

export function createFirstEmailDraftReviser({
  repository,
  now = () => new Date(),
}: FirstEmailDraftReviserDependencies) {
  return async function revise(
    db: GrowthDb,
    input: ReviseFirstEmailDraftInput,
  ): Promise<FounderFirstEmailRevision> {
    validateRequest(input);
    return repository.withTransaction(db, async (transaction) => {
      const draft = await transaction.lockDraft(input.draftTaskId);
      if (!draft) throw new FirstEmailRevisionError("not_found");

      const stored = parseStoredDraft(draft);
      if (
        draft.status !== "completed" ||
        stored.reviewState !== "draft" ||
        draft.hasEnrollment
      ) {
        throw new FirstEmailRevisionError("not_editable");
      }
      if (stored.version !== input.expectedVersion) {
        throw new FirstEmailRevisionError("version_conflict");
      }
      if (stored.version >= MAX_DRAFT_REVISIONS) {
        throw new FirstEmailRevisionError("revision_limit_reached");
      }

      const email = createFounderFirstEmailRevision({
        subject: input.subject,
        paragraphs: input.paragraphs,
        retained: {
          optOutSentence: stored.email.optOutSentence,
          conceptDisclaimer: stored.email.conceptDisclaimer,
        },
      });
      const editedAt = now().toISOString();
      const version = stored.version + 1;
      const revision: RevisionRecord = {
        version,
        source: "founder",
        editorActorId: input.founder.actorId,
        editedAt,
        email,
      };
      const outputSnapshot = {
        ...stored.snapshot,
        email,
        reviewState: "draft" as const,
        draftVersion: version,
        emailRevisions: [...stored.revisions, revision],
      };

      await transaction.saveDraftRevision({
        draftTaskId: draft.id,
        outputSnapshot,
      });
      await transaction.appendRevisionAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        draftTaskId: draft.id,
      });

      return { draftTaskId: draft.id, version, editedAt, email };
    });
  };
}

export const reviseFirstEmailDraft = createFirstEmailDraftReviser({
  repository: postgresFirstEmailRevisionRepository,
});
