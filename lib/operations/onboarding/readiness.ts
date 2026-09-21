import type { OnboardingReadinessCheck } from "./workspace-types";

export type OnboardingReadinessInput = Readonly<{
  senderConfigured: boolean;
  currentAgreement: boolean;
  noActiveJourney: boolean;
  contactAvailable: boolean;
  templateVersionAvailable: boolean;
  recipientRoleAllowed: boolean;
  billingConfigured: boolean;
  signingReady: boolean;
}>;

type ReadinessRule = Readonly<{
  id: string;
  ready: (input: OnboardingReadinessInput) => boolean;
  status: "needs_action" | "failed";
  reason: string;
  href: string | null;
}>;

const readinessRules: readonly ReadinessRule[] = [
  {
    id: "sender",
    ready: (input) => input.senderConfigured,
    status: "needs_action",
    reason: "Choose an authorised FSS sender.",
    href: "/portal/admin/settings",
  },
  {
    id: "agreement",
    ready: (input) => input.currentAgreement,
    status: "needs_action",
    reason: "Refresh the current agreement before starting this journey.",
    href: "/portal/admin/agreements",
  },
  {
    id: "existing_journey",
    ready: (input) => input.noActiveJourney,
    status: "failed",
    reason: "An active welcome journey already exists for this agreement.",
    href: null,
  },
  {
    id: "contact",
    ready: (input) => input.contactAvailable,
    status: "needs_action",
    reason: "Choose an active contact in this client workspace.",
    href: "/portal/admin/clients",
  },
  {
    id: "template",
    ready: (input) => input.templateVersionAvailable,
    status: "needs_action",
    reason: "Publish the selected checklist template version.",
    href: "/portal/admin/welcome",
  },
  {
    id: "recipient_role",
    ready: (input) => input.recipientRoleAllowed,
    status: "needs_action",
    reason: "Choose a permitted portal role for the welcome recipient.",
    href: "/portal/admin/welcome",
  },
  {
    id: "billing",
    ready: (input) => input.billingConfigured,
    status: "needs_action",
    reason: "Configure the approved billing account before starting.",
    href: "/portal/admin/settings",
  },
  {
    id: "signing",
    ready: (input) => input.signingReady,
    status: "needs_action",
    reason: "Prepare the current agreement for signing before starting.",
    href: "/portal/admin/agreements",
  },
];

export function buildOnboardingReadiness(
  input: OnboardingReadinessInput,
): readonly OnboardingReadinessCheck[] {
  return readinessRules.map((rule) =>
    rule.ready(input)
      ? { id: rule.id, status: "passed", reason: "Ready.", href: null }
      : {
          id: rule.id,
          status: rule.status,
          reason: rule.reason,
          href: rule.href,
        },
  );
}

export function canStartOnboardingJourney(
  checks: readonly OnboardingReadinessCheck[],
): boolean {
  return checks.length > 0 && checks.every((check) => check.status === "passed");
}
