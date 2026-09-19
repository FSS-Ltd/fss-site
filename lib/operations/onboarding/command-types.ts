import type {
  ProposalApprovalSnapshot,
  WelcomeApprovalSnapshot,
  JourneyState,
  OnboardingStep,
} from "./types";
export class JourneyConflict extends Error {
  constructor(
    readonly code:
      | "stale_preview"
      | "stale_journey"
      | "unavailable"
      | "approval_conflict"
      | "recovery_required"
      | "configuration",
    message: string,
  ) {
    super(message);
    this.name = "JourneyConflict";
  }
}

export type JourneyActor = {
  actorId: string;
};
export interface JourneyJob {
  id: string;
  step: OnboardingStep;
  recipient: string;
  state:
    | "pending"
    | "leased"
    | "succeeded"
    | "retryable_failure"
    | "unknown_outcome"
    | "held"
    | "cancelled";
  dueAt: string;
  attempts: number;
  failureCode: string | null;
  uncertain: boolean;
  providerId: string | null;
  acceptedAt: string | null;
}
export interface JourneyView {
  id: string;
  agreementId: string;
  agreementTitle: string;
  state: JourneyState;
  generation: number;
  proposalApprovalId: string | null;
  welcome: WelcomeApprovalSnapshot;
  proposal: ProposalApprovalSnapshot | null;
  currentProposal: boolean;
  proposalDueAt: string | null;
  postSignatureDueAt: string | null;
  signatureAt: string | null;
  failureCode: string | null;
  jobs: JourneyJob[];
}
export interface WelcomePreview {
  kind: "welcome";
  token: string;
  agreementId: string;
  snapshot: WelcomeApprovalSnapshot;
  pdfBase64: string;
}
export interface ProposalPreview {
  kind: "proposal";
  token: string;
  journeyId: string;
  snapshot: ProposalApprovalSnapshot;
}
export type JourneyPreview = WelcomePreview | ProposalPreview;
export type JourneyCommandResult =
  | { preview: JourneyPreview }
  | { journeyId: string };

export interface JourneyBillingAccount {
  accountId: string;
  livemode: boolean;
}
