import type {
  OnboardingEvidenceRule,
  OnboardingTaskKind,
} from "@/lib/operations/onboarding/workspace-types";

export const onboardingTaskKindLabels: Readonly<
  Record<OnboardingTaskKind, string>
> = {
  acknowledgement: "Read and acknowledge",
  agreement: "Agreement",
  billing: "Billing",
  booking: "Booking",
  custom: "FSS confirmation",
  profile: "Profile",
  upload: "File upload",
};

export const onboardingEvidenceRuleByKind: Readonly<
  Record<OnboardingTaskKind, OnboardingEvidenceRule>
> = {
  acknowledgement: "acknowledged",
  agreement: "agreement_signed",
  billing: "billing_ready",
  booking: "booking_confirmed",
  custom: "staff_confirmed",
  profile: "profile_saved",
  upload: "cleared_documents",
};

export const onboardingEvidenceLabels: Readonly<
  Record<OnboardingEvidenceRule, string>
> = {
  acknowledged: "Client acknowledgement",
  agreement_signed: "Signed agreement record",
  billing_ready: "Verified billing record",
  booking_confirmed: "Confirmed booking",
  cleared_documents: "Cleared document evidence",
  profile_saved: "Saved client profile",
  staff_confirmed: "FSS confirmation",
};

export const journeyDraftStageLabels = {
  access: "People and access",
  activate: "Activation review",
  content: "Welcome content",
  schedule: "Next-step schedule",
  setup: "Client and agreement",
} as const;
