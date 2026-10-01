import type { AgreementRecord } from "@/lib/operations/agreements/types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type {
  JourneyBillingAccount,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import type { JourneyBuilderStage } from "@/lib/operations/onboarding/builder-stage";
import type { OnboardingWorkspaceJourneyDraft } from "@/lib/operations/onboarding/workspace-types";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-pack-contract";
import type { ActiveStudioSettings } from "@/lib/operations/studio/active-settings-types";
export interface JourneyComposerProps {
  agreements: readonly { id: string; label: string; version: number }[];
  agreementRecords?: AgreementRecord[];
  contacts: readonly { id: string; name: string; email: string }[];
  templates: readonly { id: string; name: string; version: number }[];
  welcomePacks: readonly WelcomePack[];
  drafts?: readonly OnboardingWorkspaceJourneyDraft[];
  organisationId: string;
  organisationName?: string;
  commandEndpoint: string;
  initialStage?: JourneyBuilderStage;
  billing?: JourneyBillingAccount | null;
  settings?: ActiveStudioSettings;
  approvals?: SigningApproval[];
  journeys?: JourneyView[];
}
