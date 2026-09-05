import { renderSectorExampleFirstEmail } from "../../sector-examples/first-email";
import { parseWebsiteEmailNarrative } from "../research/ingestion-schema";
import {
  deriveHistoricalEmailNarrative,
  renderPreviewFirstEmail,
} from "../prospect-previews/content";
import { prospectPreviewAssessmentSectionSchema } from "../prospect-previews/types";
import {
  InvalidStoredFirstEmailDraftError,
  MAX_FIRST_EMAIL_DRAFT_REVISIONS,
  parseStoredFirstEmailDraft,
  sameFirstEmailCandidate,
  type RevisionRecord,
  type StoredFirstEmailDraft,
} from "./first-email-draft-snapshot";

const SYSTEM_ACTOR_ID = "first-email-template-refresh";

export type FirstEmailTemplateRefreshErrorCode =
  | "invalid_stored_draft"
  | "not_refreshable"
  | "invalid_narrative";

export class FirstEmailTemplateRefreshError extends Error {
  constructor(readonly code: FirstEmailTemplateRefreshErrorCode) {
    super("The first-email draft could not be refreshed.");
    this.name = "FirstEmailTemplateRefreshError";
  }
}

export type RefreshFirstEmailTemplateInput = {
  draft: StoredFirstEmailDraft;
  previewUrl?: string;
  sector?: string;
  businessName?: string;
  siteUrl?: string;
  refreshedAt: Date;
  historicalAssessment?: {
    trustSignals: unknown;
    conversionPlan: unknown;
    firstPartyEvidenceUrl: string | null;
  };
};

export type FirstEmailTemplateRefreshResult =
  | { status: "unchanged" }
  | {
      status: "refreshed";
      outputSnapshot: Record<string, unknown>;
      version: number;
    };

export function refreshFirstEmailTemplate(
  input: RefreshFirstEmailTemplateInput,
): FirstEmailTemplateRefreshResult {
  let stored;
  try {
    stored = parseStoredFirstEmailDraft(input.draft);
  } catch (error) {
    if (error instanceof InvalidStoredFirstEmailDraftError) {
      throw new FirstEmailTemplateRefreshError("invalid_stored_draft");
    }
    throw error;
  }

  if (
    input.draft.status !== "completed" ||
    input.draft.hasEnrollment ||
    stored.reviewState !== "draft" ||
    stored.version >= MAX_FIRST_EMAIL_DRAFT_REVISIONS
  ) {
    throw new FirstEmailTemplateRefreshError("not_refreshable");
  }

  let narrative;
  try {
    let storedNarrative = stored.snapshot.emailNarrative;
    if (
      storedNarrative === undefined &&
      input.historicalAssessment?.firstPartyEvidenceUrl
    ) {
      const historical = input.historicalAssessment;
      storedNarrative = deriveHistoricalEmailNarrative({
        trustSignals: prospectPreviewAssessmentSectionSchema.parse(
          historical.trustSignals,
        ),
        conversionPlan: prospectPreviewAssessmentSectionSchema.parse(
          historical.conversionPlan,
        ),
        firstPartyEvidenceUrl: input.historicalAssessment.firstPartyEvidenceUrl,
      });
    }
    narrative = parseWebsiteEmailNarrative(storedNarrative);
  } catch {
    throw new FirstEmailTemplateRefreshError("invalid_narrative");
  }

  if (
    (input.sector === undefined || input.siteUrl === undefined) &&
    !input.previewUrl
  ) {
    throw new FirstEmailTemplateRefreshError("not_refreshable");
  }

  const emailInput = {
    subject: stored.email.subject,
    narrative,
    previewUrl: input.previewUrl,
    optOutSentence: stored.email.optOutSentence,
    conceptDisclaimer: stored.email.conceptDisclaimer,
  };
  const email =
    input.sector !== undefined && input.siteUrl !== undefined
      ? renderSectorExampleFirstEmail({
          ...emailInput,
          sector: input.sector,
          businessName: input.businessName,
          siteUrl: input.siteUrl,
        })
      : renderPreviewFirstEmail({
          ...emailInput,
          previewUrl: input.previewUrl ?? "",
        });
  if (sameFirstEmailCandidate(stored.email, email)) {
    return { status: "unchanged" };
  }

  const version = stored.version + 1;
  const revision: RevisionRecord = {
    version,
    source: "system",
    editorActorId: SYSTEM_ACTOR_ID,
    editedAt: input.refreshedAt.toISOString(),
    email,
  };
  return {
    status: "refreshed",
    version,
    outputSnapshot: {
      ...stored.snapshot,
      emailNarrative: narrative,
      email,
      reviewState: "draft",
      draftVersion: version,
      emailRevisions: [...stored.revisions, revision],
    },
  };
}
