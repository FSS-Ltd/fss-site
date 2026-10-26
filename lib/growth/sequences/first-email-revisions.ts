import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import type { FirstEmailCandidate } from "../research/types";
import { createFounderFirstEmailRevision } from "./edit-first-email";
import {
  InvalidStoredFirstEmailDraftError,
  MAX_FIRST_EMAIL_DRAFT_REVISIONS,
  parseStoredFirstEmailDraft,
  type RevisionRecord,
  type StoredFirstEmailDraft,
} from "./first-email-draft-snapshot";
import { postgresFirstEmailRevisionRepository } from "./first-email-revision-repository";
import type { z } from "zod";
import type { globalFirstEmailSchema } from "../research/global-schema";
import { isResearchEmailSnapshot } from "./research-email-snapshot";
import { reviseResearchEmailDraft } from "./research-email-revisions";
import { FirstEmailRevisionError } from "./first-email-revision-errors";
export {
  FirstEmailRevisionError,
  type FirstEmailRevisionErrorCode,
} from "./first-email-revision-errors";

const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

export type { StoredFirstEmailDraft } from "./first-email-draft-snapshot";

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
  email: FirstEmailCandidate | z.infer<typeof globalFirstEmailSchema>;
};

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
      if (isResearchEmailSnapshot(draft.outputSnapshot)) {
        return reviseResearchEmailDraft(transaction, draft, input, now());
      }

      let stored;
      try {
        stored = parseStoredFirstEmailDraft(draft);
      } catch (error) {
        if (error instanceof InvalidStoredFirstEmailDraftError) {
          throw new FirstEmailRevisionError("invalid_stored_draft");
        }
        throw error;
      }
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
      if (stored.version >= MAX_FIRST_EMAIL_DRAFT_REVISIONS) {
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
        visual: {
          ...stored.visual,
          conceptDisclaimer: email.conceptDisclaimer,
        },
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
