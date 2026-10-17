import type { AgreementBuilderDraftContent } from "@/lib/operations/agreements/builder-draft-schema";
import type { AgreementEngagementChoice } from "./agreement-builder-step-panel";

export function prefillFromEngagement(
  content: AgreementBuilderDraftContent,
  engagement: AgreementEngagementChoice | undefined,
): AgreementBuilderDraftContent {
  if (!engagement) return content;
  const agreement = content.agreement ?? {};
  return {
    ...content,
    engagementId: engagement.id,
    agreement: {
      ...agreement,
      title: agreement.title || engagement.name,
      ...(engagement.primaryGoal
        ? { goals: agreement.goals || engagement.primaryGoal }
        : {}),
      ...(engagement.proposedScope
        ? { scope: agreement.scope || engagement.proposedScope }
        : {}),
    },
  };
}

export function replaceEngagement(
  content: AgreementBuilderDraftContent,
  engagement: AgreementEngagementChoice,
): AgreementBuilderDraftContent {
  const currency = content.agreement?.currency;
  return prefillFromEngagement(
    { agreement: currency ? { currency } : {} },
    engagement,
  );
}
