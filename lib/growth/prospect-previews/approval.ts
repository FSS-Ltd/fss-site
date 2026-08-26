import { resolveSiteUrl } from "@/lib/config/site-url";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { parseWebsiteEmailNarrative } from "../research/ingestion-schema";
import type { WebsiteEmailNarrative } from "../research/types";
import {
  InvalidStoredFirstEmailDraftError,
  MAX_FIRST_EMAIL_DRAFT_REVISIONS,
  parseStoredFirstEmailDraft,
  type RevisionRecord,
  type StoredFirstEmailDraft,
} from "../sequences/first-email-draft-snapshot";
import { postgresProspectPreviewApprovalRepository } from "./approval-repository";
import {
  deriveHistoricalEmailNarrative,
  renderPreviewFirstEmail,
} from "./content";
import {
  PROSPECT_PREVIEW_PUBLIC_ID_PATTERN,
  prospectPreviewAssessmentSectionSchema,
} from "./types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;
const TERMINAL_PROSPECT_STATUSES = new Set([
  "won",
  "lost",
  "rejected",
  "suppressed",
]);

export type LockedProspectPreviewApprovalState = {
  prospect: {
    id: string;
    status: string;
    version: number;
  };
  preview: {
    id: string;
    publicId: string;
    status: string;
    version: number;
  };
  assessment: {
    status: string;
    trustSignals?: unknown;
    conversionPlan?: unknown;
    firstPartyEvidenceUrl?: string | null;
  };
  draft: StoredFirstEmailDraft;
};

export type PublishPreviewAndSaveEmailInput = {
  prospectId: string;
  expectedProspectVersion: number;
  previewId: string;
  expectedPreviewVersion: number;
  draftTaskId: string;
  outputSnapshot: Record<string, unknown>;
  approvedAt: Date;
  approvedBy: string;
};

export type AppendProspectPreviewApprovalAuditInput = {
  correlationId: string;
  actorId: string;
  prospectId: string;
  previewId: string;
};

export interface ProspectPreviewApprovalTransaction {
  lockApprovalState(
    prospectId: string,
  ): Promise<LockedProspectPreviewApprovalState | null>;
  publishPreviewAndSaveEmail(
    input: PublishPreviewAndSaveEmailInput,
  ): Promise<void>;
  appendApprovalAudit(
    input: AppendProspectPreviewApprovalAuditInput,
  ): Promise<void>;
}

export interface ProspectPreviewApprovalRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: ProspectPreviewApprovalTransaction) => Promise<T>,
  ): Promise<T>;
}

export type ApproveProspectPreviewInput = {
  prospectId: string;
  expectedProspectVersion: number;
  expectedPreviewVersion: number;
  founder: FounderSession;
  correlationId: string;
};

export type ApproveProspectPreviewResult = {
  prospectId: string;
  publicId: string;
  status: "published";
  emailDraftVersion: number;
};

export type ProspectPreviewApprovalErrorCode =
  | "not_found"
  | "version_conflict"
  | "not_publishable"
  | "invalid_draft";

export class ProspectPreviewApprovalError extends Error {
  constructor(readonly code: ProspectPreviewApprovalErrorCode) {
    super("The prospect preview could not be approved.");
    this.name = "ProspectPreviewApprovalError";
  }
}

function validateRequest(input: ApproveProspectPreviewInput): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !Number.isInteger(input.expectedProspectVersion) ||
    input.expectedProspectVersion < 1 ||
    !Number.isInteger(input.expectedPreviewVersion) ||
    input.expectedPreviewVersion < 1 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId) ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200
  ) {
    throw new TypeError("Prospect preview approval request is invalid.");
  }
}

function readEmailNarrative(
  snapshot: Record<string, unknown>,
  assessment: LockedProspectPreviewApprovalState["assessment"],
): WebsiteEmailNarrative {
  if ("emailNarrative" in snapshot) {
    try {
      return parseWebsiteEmailNarrative(snapshot.emailNarrative);
    } catch {
      throw new ProspectPreviewApprovalError("invalid_draft");
    }
  }

  const trustSignals = prospectPreviewAssessmentSectionSchema.safeParse(
    assessment.trustSignals,
  );
  const conversionPlan = prospectPreviewAssessmentSectionSchema.safeParse(
    assessment.conversionPlan,
  );
  if (
    !trustSignals.success ||
    !conversionPlan.success ||
    assessment.firstPartyEvidenceUrl === undefined ||
    assessment.firstPartyEvidenceUrl === null
  ) {
    throw new ProspectPreviewApprovalError("invalid_draft");
  }

  const narrative = deriveHistoricalEmailNarrative({
    trustSignals: trustSignals.data,
    conversionPlan: conversionPlan.data,
    firstPartyEvidenceUrl: assessment.firstPartyEvidenceUrl,
  });
  if (narrative === null) {
    throw new ProspectPreviewApprovalError("invalid_draft");
  }
  return narrative;
}

function previewUrl(siteUrl: string, publicId: string): string {
  if (!PROSPECT_PREVIEW_PUBLIC_ID_PATTERN.test(publicId)) {
    throw new ProspectPreviewApprovalError("not_publishable");
  }
  return new URL(`/preview/p/${publicId}`, siteUrl).toString();
}

type ProspectPreviewApproverDependencies = {
  repository: ProspectPreviewApprovalRepository;
  now?: () => Date;
  siteUrl?: string;
};

export function createProspectPreviewApprover({
  repository,
  now = () => new Date(),
  siteUrl = resolveSiteUrl(),
}: ProspectPreviewApproverDependencies) {
  return async function approve(
    db: GrowthDb,
    input: ApproveProspectPreviewInput,
  ): Promise<ApproveProspectPreviewResult> {
    validateRequest(input);

    return repository.withTransaction(db, async (transaction) => {
      const state = await transaction.lockApprovalState(input.prospectId);
      if (!state) throw new ProspectPreviewApprovalError("not_found");
      if (
        state.prospect.version !== input.expectedProspectVersion ||
        state.preview.version !== input.expectedPreviewVersion
      ) {
        throw new ProspectPreviewApprovalError("version_conflict");
      }
      if (
        TERMINAL_PROSPECT_STATUSES.has(state.prospect.status) ||
        state.preview.status !== "draft" ||
        !state.assessment.status
      ) {
        throw new ProspectPreviewApprovalError("not_publishable");
      }

      let storedDraft;
      try {
        storedDraft = parseStoredFirstEmailDraft(state.draft);
      } catch (error) {
        if (error instanceof InvalidStoredFirstEmailDraftError) {
          throw new ProspectPreviewApprovalError("invalid_draft");
        }
        throw error;
      }
      if (
        state.draft.status !== "completed" ||
        state.draft.hasEnrollment ||
        storedDraft.reviewState !== "draft" ||
        storedDraft.version >= MAX_FIRST_EMAIL_DRAFT_REVISIONS
      ) {
        throw new ProspectPreviewApprovalError("not_publishable");
      }

      const narrative = readEmailNarrative(
        storedDraft.snapshot,
        state.assessment,
      );
      const email = renderPreviewFirstEmail({
        subject: storedDraft.email.subject,
        narrative,
        previewUrl: previewUrl(siteUrl, state.preview.publicId),
        optOutSentence: storedDraft.email.optOutSentence,
        conceptDisclaimer: storedDraft.email.conceptDisclaimer,
      });
      const approvedAt = now();
      const emailDraftVersion = storedDraft.version + 1;
      const revision: RevisionRecord = {
        version: emailDraftVersion,
        source: "system",
        editorActorId: "prospect-preview-approval",
        editedAt: approvedAt.toISOString(),
        email,
      };
      const outputSnapshot = {
        ...storedDraft.snapshot,
        email,
        reviewState: "draft" as const,
        draftVersion: emailDraftVersion,
        emailRevisions: [...storedDraft.revisions, revision],
      };

      await transaction.publishPreviewAndSaveEmail({
        prospectId: state.prospect.id,
        expectedProspectVersion: input.expectedProspectVersion,
        previewId: state.preview.id,
        expectedPreviewVersion: input.expectedPreviewVersion,
        draftTaskId: state.draft.id,
        outputSnapshot,
        approvedAt,
        approvedBy: input.founder.actorId,
      });
      await transaction.appendApprovalAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        prospectId: state.prospect.id,
        previewId: state.preview.id,
      });

      return {
        prospectId: state.prospect.id,
        publicId: state.preview.publicId,
        status: "published",
        emailDraftVersion,
      };
    });
  };
}

export const approveProspectPreview = createProspectPreviewApprover({
  repository: postgresProspectPreviewApprovalRepository,
});
