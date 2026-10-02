"use client";

import { AgreementBuilderFeesStep } from "./agreement-builder-fees-step";
import { AgreementBuilderLinkStep } from "./agreement-builder-link-step";
import { AgreementBuilderScopeStep } from "./agreement-builder-scope-step";
import { AgreementBuilderPeopleStep } from "./agreement-builder-people-step";
import { AgreementBuilderDocumentStep } from "./agreement-builder-document-step";
import { AgreementBuilderReviewStep } from "./agreement-builder-review-step";
import type { AgreementBuilderStep } from "@/lib/operations/agreements/builder-draft-schema";
import type { BuilderStepProps } from "./agreement-builder-step-support";

export type AgreementEngagementChoice = Readonly<{ id: string; name: string }>;

export const agreementBuilderSteps = [
  "link",
  "scope",
  "fees",
  "people",
  "document",
  "review",
] as const satisfies readonly AgreementBuilderStep[];

const stepDetails: Record<
  AgreementBuilderStep,
  Readonly<{ label: string; summary: string }>
> = {
  document: { label: "Document", summary: "Document & evidence" },
  fees: { label: "Fees", summary: "Fees & terms" },
  link: { label: "Work", summary: "Client & engagement" },
  people: { label: "People", summary: "Contacts & signers" },
  review: { label: "Review", summary: "Preview & approve" },
  scope: { label: "Scope", summary: "Scope & outcomes" },
};

export function agreementBuilderStepDetail(
  step: AgreementBuilderStep,
): Readonly<{ label: string; summary: string }> {
  return stepDetails[step];
}

export function AgreementBuilderStepPanel(
  props: BuilderStepProps &
    Readonly<{
      draftExists: boolean;
      engagementHref: string;
      engagements: readonly AgreementEngagementChoice[];
      finalise: () => Promise<void>;
      organisationName: string;
      step: AgreementBuilderStep;
    }>,
): React.JSX.Element {
  switch (props.step) {
    case "link":
      return <AgreementBuilderLinkStep {...props} />;
    case "scope":
      return <AgreementBuilderScopeStep {...props} />;
    case "fees":
      return <AgreementBuilderFeesStep {...props} />;
    case "people":
      return <AgreementBuilderPeopleStep {...props} />;
    case "document":
      return <AgreementBuilderDocumentStep {...props} />;
    case "review":
      return <AgreementBuilderReviewStep {...props} />;
  }
}
