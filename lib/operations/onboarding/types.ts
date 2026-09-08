export const onboardingSteps = [
  "welcome",
  "proposal_access",
  "proposal",
  "invoice",
  "invitation",
  "thank_you",
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];
export type JourneyState =
  | "active"
  | "paused"
  | "blocked"
  | "completed"
  | "cancelled";
export interface ApprovedEmail {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}
export interface WelcomePage {
  title: string;
  paragraphs: string[];
}
export interface WelcomeContent {
  contactFirstName: string;
  primaryGoal: string;
  outcomeSummary: string;
  senderName: string;
  organisationName: string;
  from: string;
  replyTo: string;
  pages: WelcomePage[];
}
export interface WelcomeApprovalSnapshot {
  recipient: string;
  invoice: { obligationKey: string; accountId: string; livemode: boolean };
  content: WelcomeContent;
  welcome: ApprovedEmail;
  accessibleHtml: string;
  pdfHash: string;
  thankYou: {
    subject: string;
    intro: string;
    nextStep: string;
    requiredAction: string;
  };
}
export interface ProposalApprovalSnapshot {
  signingApprovalId: string;
  approvalHash: string;
  revision: number;
  signers: string[];
  access: {
    email: string;
    role: "owner" | "contributor" | "billing_contact" | "viewer";
  }[];
  emails: ApprovedEmail[];
  portalUrl: string;
}
export interface OnboardingLease {
  jobId: string;
  recipient: string;
  uncertain: boolean;
  journeyId: string;
  organisationId: string;
  agreementId: string;
  approvalId: string;
  signingApprovalId: string | null;
  step: OnboardingStep;
  generation: number;
  leaseToken: string;
  idempotencyKey: string;
  attempts: number;
  firstAttemptAt: string | null;
  dueAt: string;
  snapshot: WelcomeApprovalSnapshot;
  proposal: ProposalApprovalSnapshot | null;
  pdf: Buffer;
  invoice: EffectReceipt | null;
  invitation: EffectReceipt | null;
}
export interface EffectReceipt {
  providerId: string;
  acceptedAt: string;
  /** Persist only stable invoice/access URLs, never a private invitation token. */
  url?: string;
}
export type EffectResult =
  | { status: "succeeded"; receipt: EffectReceipt }
  | {
      status: "failed";
      code:
        | "transport"
        | "rate_limited"
        | "invalid_recipient"
        | "invalid_contract"
        | "configuration"
        | "unknown_outcome";
      uncertain: boolean;
      retryable: boolean;
      retryAfterMs?: number;
    };
export interface OnboardingEmailInput {
  lease: OnboardingLease;
  email: ApprovedEmail;
  attachment?: { filename: string; content: Buffer };
}
export interface OnboardingEffects {
  sendEmail(input: OnboardingEmailInput): Promise<EffectResult>;
  ensureProposalAccess(lease: OnboardingLease): Promise<EffectResult>;
  createInvoice(lease: OnboardingLease): Promise<EffectResult>;
  ensureInvitation(lease: OnboardingLease): Promise<EffectResult>;
}
export interface OnboardingStore {
  claim(limit: number, now: Date): Promise<OnboardingLease[]>;
  /** Atomically fences generation/state/lease, then records the permanent attempt. */
  beginEffect(lease: OnboardingLease, now: Date): Promise<boolean>;
  succeed(lease: OnboardingLease, receipt: EffectReceipt): Promise<void>;
  fail(
    lease: OnboardingLease,
    code: string,
    nextAttempt: Date | null,
    uncertain: boolean,
  ): Promise<void>;
}
