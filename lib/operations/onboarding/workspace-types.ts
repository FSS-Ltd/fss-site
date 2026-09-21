import type { PortalRole } from "../auth/types";

export const onboardingTaskKinds = [
  "profile",
  "agreement",
  "billing",
  "upload",
  "booking",
  "acknowledgement",
  "custom",
] as const;

export type OnboardingTaskKind = (typeof onboardingTaskKinds)[number];

export const onboardingDueRules = [
  "activation",
  "signature",
  "previous_task",
] as const;

export type OnboardingDueRule = (typeof onboardingDueRules)[number];

export const onboardingEvidenceRules = [
  "profile_saved",
  "agreement_signed",
  "billing_ready",
  "cleared_documents",
  "booking_confirmed",
  "acknowledged",
  "staff_confirmed",
] as const;

export type OnboardingEvidenceRule = (typeof onboardingEvidenceRules)[number];

export type OnboardingTaskDefinition = Readonly<{
  id: string;
  title: string;
  instructions: string;
  kind: OnboardingTaskKind;
  ownerRole: PortalRole;
  required: boolean;
  dependsOnTaskId: string | null;
  dueRule: OnboardingDueRule;
  evidenceRule: OnboardingEvidenceRule;
  bookingUrl: string | null;
}>;

export type OnboardingTemplateDraft = Readonly<{
  name: string;
  tasks: readonly OnboardingTaskDefinition[];
}>;

export type OnboardingTemplateVersion = Readonly<{
  id: string;
  templateId: string;
  version: number;
  name: string;
  state: "draft" | "published";
  tasks: readonly OnboardingTaskDefinition[];
  createdAt: string;
}>;

export type OnboardingJourneyDraft = Readonly<{
  id: string;
  organisationId: string;
  templateVersionId: string;
  agreementId: string;
  expectedAgreementVersion: number;
  stage: "setup" | "content" | "access" | "schedule" | "activate";
  version: number;
}>;

export type ClientChecklistTask = Readonly<{
  id: string;
  title: string;
  instructions: string;
  kind: OnboardingTaskKind;
  required: boolean;
  state: "blocked" | "available" | "complete";
  ownerRole: PortalRole;
  dueAt: string | null;
  completionDetail: string | null;
}>;

export type OnboardingReadinessCheck = Readonly<{
  id: string;
  status: "passed" | "needs_action" | "failed";
  reason: string;
  href: string | null;
}>;

export type OnboardingWorkspaceTemplateVersion = Readonly<{
  id: string;
  templateId: string;
  version: number;
  name: string;
  tasks: readonly OnboardingTaskDefinition[];
  publishedAt: string;
}>;

export type OnboardingWorkspaceTemplateDraft = Readonly<{
  id: string;
  name: string;
  draftVersion: number;
  publishedVersion: number;
  tasks: readonly OnboardingTaskDefinition[];
}>;

export type OnboardingWorkspaceJourneyDraft = Readonly<{
  id: string;
  agreementId: string;
  contactId: string;
  templateVersionId: string;
  stage: OnboardingJourneyDraft["stage"];
  expectedAgreementVersion: number | null;
  recipientRole: PortalRole | null;
  version: number;
  updatedAt: string;
}>;

export type OnboardingWorkspaceTask = Readonly<{
  id: string;
  journeyId: string;
  templateVersionId: string;
  title: string;
  instructions: string;
  kind: OnboardingTaskKind;
  required: boolean;
  ownerRole: PortalRole;
  dueRule: OnboardingDueRule;
  bookingUrl: string | null;
  state: ClientChecklistTask["state"];
  completionDetail: string | null;
}>;

export type OnboardingWorkspace = Readonly<{
  templates: readonly OnboardingWorkspaceTemplateVersion[];
  templateDrafts: readonly OnboardingWorkspaceTemplateDraft[];
  journeyDrafts: readonly OnboardingWorkspaceJourneyDraft[];
  tasks: readonly OnboardingWorkspaceTask[];
}>;
