import type { AgreementDraft } from "./types";
import {
  completeAgreementBuilderDraftContentSchema,
  type AgreementBuilderDraftContent,
} from "./builder-draft-schema";
import { publishCommercialOfferSchema } from "./commercial-types";
import { draftSchema } from "./validation";
import {
  builderValidationIssues,
  type AgreementBuilderValidationIssue,
} from "./builder-draft-validation-messages";

export type AgreementBuilderReadiness =
  | Readonly<{ success: true; draft: AgreementDraft; engagementId: string }>
  | Readonly<{
      success: false;
      issues: readonly AgreementBuilderValidationIssue[];
    }>;

export class AgreementBuilderDraftValidationError extends Error {
  constructor(readonly issues: readonly AgreementBuilderValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "AgreementBuilderDraftValidationError";
  }
}

/** Uses the publication schemas for both Review and the saved-draft command. */
export function validateAgreementBuilderDraft(
  content: AgreementBuilderDraftContent,
): AgreementBuilderReadiness {
  const complete = completeAgreementBuilderDraftContentSchema.safeParse({
    ...content,
    agreement: content.agreement ?? {},
  });
  if (!complete.success)
    return {
      success: false,
      issues: builderValidationIssues(complete.error.issues, content),
    };

  const draft = draftSchema.safeParse({
    ...complete.data.agreement,
    documentHash: "0".repeat(64),
    documentReference: "private:agreement-drafts/unbound.pdf",
  });
  if (!draft.success)
    return {
      success: false,
      issues: builderValidationIssues(draft.error.issues, content),
    };

  if (complete.data.commercialOffer) {
    const offer = publishCommercialOfferSchema.safeParse({
      draft: draft.data,
      engagementId: complete.data.engagementId,
      ...complete.data.commercialOffer,
    });
    if (!offer.success)
      return {
        success: false,
        issues: builderValidationIssues(offer.error.issues, content),
      };
  }
  return {
    success: true,
    draft: draft.data,
    engagementId: complete.data.engagementId,
  };
}
