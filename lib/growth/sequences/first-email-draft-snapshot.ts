import { z } from "zod";

import { parseFirstEmailCandidate } from "../research/ingestion-schema";
import type { FirstEmailCandidate } from "../research/types";

export const MAX_FIRST_EMAIL_DRAFT_REVISIONS = 100;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

function exactText(min: number, max: number) {
  return z
    .string()
    .min(min)
    .max(max)
    .refine((value) => value === value.trim());
}

export const storedVisualSchema = z.discriminatedUnion("kind", [
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

export type StoredFirstEmailVisual = z.infer<typeof storedVisualSchema>;

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
      .max(MAX_FIRST_EMAIL_DRAFT_REVISIONS)
      .optional(),
  })
  .passthrough();

export type RevisionRecord = {
  version: number;
  source: "agent" | "founder";
  editorActorId: string;
  editedAt: string;
  email: FirstEmailCandidate;
};

export type ParsedFirstEmailDraftSnapshot = {
  snapshot: Record<string, unknown>;
  email: FirstEmailCandidate;
  visual: StoredFirstEmailVisual;
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

export class InvalidStoredFirstEmailDraftError extends Error {
  constructor() {
    super("The stored first-email draft is invalid.");
    this.name = "InvalidStoredFirstEmailDraftError";
  }
}

export function sameFirstEmailCandidate(
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

export function parseStoredFirstEmailDraft(
  draft: StoredFirstEmailDraft,
): ParsedFirstEmailDraftSnapshot {
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
        visual: snapshot.visual,
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
      !sameFirstEmailCandidate(revisions.at(-1)!.email, currentEmail)
    ) {
      throw new Error("Inconsistent revision history.");
    }
    return {
      snapshot,
      email: currentEmail,
      visual: snapshot.visual,
      reviewState,
      version: snapshot.draftVersion,
      revisions,
    };
  } catch {
    throw new InvalidStoredFirstEmailDraftError();
  }
}
