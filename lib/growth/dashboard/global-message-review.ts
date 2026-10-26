import {
  isResearchEmailSnapshot,
  researchEmailFingerprint,
  researchEmailSnapshotSchema,
} from "../sequences/research-email-snapshot";
import type {
  MessageReviewCitation,
  MessageReviewDraftRow,
  MessageReviewResult,
} from "./message-review";

export const isGlobalDraftSnapshot = isResearchEmailSnapshot;

export function createGlobalMessageReview(
  draft: MessageReviewDraftRow,
  founderEmail: string,
  suppressed: boolean,
  citations: readonly MessageReviewCitation[],
  hasEnrollment = false,
): MessageReviewResult {
  const parsed = researchEmailSnapshotSchema.safeParse(draft.outputSnapshot);
  if (!parsed.success || draft.status !== "completed" || !draft.completedAt) {
    return {
      status: "unavailable",
      reason: "This research draft is incomplete or failed safety validation.",
    };
  }
  if (parsed.data.reviewState !== "research_only" || hasEnrollment)
    return {
      status: "unavailable",
      reason:
        "This email has already been approved. Check its outreach timeline for delivery status.",
    };

  const email = parsed.data.email;
  const reasons: string[] = [];
  if (suppressed)
    reasons.push("This contact is suppressed and cannot be emailed.");
  if (draft.corporateStatus !== "active")
    reasons.push("The business status must be verified before sending.");

  return {
    status: "ready",
    data: {
      draftTaskId: draft.id,
      version: parsed.data.draftVersion,
      revisionCount: parsed.data.emailRevisions.length,
      prospectId: draft.prospectId,
      prospectVersion: draft.prospectVersion,
      businessName: draft.businessName,
      websiteUrl: draft.websiteUrl,
      fitScore: draft.fitScore,
      recommendedOffer: draft.recommendedOffer,
      estimatedOneOffMinPence: draft.estimatedOneOffMinPence,
      estimatedOneOffMaxPence: draft.estimatedOneOffMaxPence,
      contactName:
        [draft.contactFirstName, draft.contactLastName]
          .filter(Boolean)
          .join(" ") || "Business contact",
      contactEmail: draft.contactEmail,
      founderEmail,
      subject: email.subject,
      previewHtml: email.html,
      previewText: email.text,
      editableParagraphs: email.text.split(/\n{2,}/),
      wordCount: email.wordCount,
      imageAltText: "",
      imageByteSize: null,
      visualKind: "none",
      visualReviewStatus: null,
      researchOnly: true,
      approvalFingerprint: researchEmailFingerprint(
        parsed.data,
        draft.contactEmail,
        draft.prospectVersion,
      ),
      citations,
      createdAt: draft.completedAt.toISOString(),
      eligibility: { ready: reasons.length === 0, reasons },
      followUpCadence: [],
    },
  };
}
