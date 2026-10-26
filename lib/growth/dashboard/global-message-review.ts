import { z } from "zod";

import { globalFirstEmailSchema } from "../research/global-schema";
import type {
  MessageReviewCitation,
  MessageReviewDraftRow,
  MessageReviewResult,
} from "./message-review";

const globalDraftSnapshotSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    reviewState: z.literal("research_only"),
    email: globalFirstEmailSchema,
  })
  .strict();

export function isGlobalDraftSnapshot(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === "2.0"
  );
}

export function createGlobalMessageReview(
  draft: MessageReviewDraftRow,
  founderEmail: string,
  suppressed: boolean,
  citations: readonly MessageReviewCitation[],
): MessageReviewResult {
  const parsed = globalDraftSnapshotSchema.safeParse(draft.outputSnapshot);
  if (!parsed.success || draft.status !== "completed" || !draft.completedAt) {
    return {
      status: "unavailable",
      reason: "This research draft is incomplete or failed safety validation.",
    };
  }

  const email = parsed.data.email;
  const reasons = [
    "Research only. Outreach has not been approved for this contact.",
  ];
  if (suppressed)
    reasons.push("This contact is suppressed and cannot be emailed.");

  return {
    status: "ready",
    data: {
      draftTaskId: draft.id,
      version: 1,
      revisionCount: 0,
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
      editableParagraphs: [],
      wordCount: email.wordCount,
      imageAltText: "",
      imageByteSize: null,
      visualKind: "none",
      visualReviewStatus: null,
      researchOnly: true,
      citations,
      createdAt: draft.completedAt.toISOString(),
      eligibility: { ready: false, reasons },
      followUpCadence: [],
    },
  };
}
