import {
  PortalCard,
  StatusBadge,
  type PortalStatus,
} from "@/components/portal/ui";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";

export type PortalAgreementStatus =
  | "draft"
  | "awaiting_signature"
  | "signed"
  | "superseded"
  | "voided";

export type SigningStatusInput = Pick<SigningApproval, "status"> & {
  allRequiredSignaturesRecorded: boolean;
};

export function hasCompleteSigningEvidence(approval: SigningApproval): boolean {
  return (
    approval.status === "completed" &&
    approval.requiredSigners.length > 0 &&
    approval.requiredSigners.every((requiredSigner) =>
      approval.signatures.some(
        (signature) => signature.email === requiredSigner,
      ),
    )
  );
}

export type PortalAgreementSummary = Readonly<{
  agreementId: string;
  approvalId: string;
  status: PortalAgreementStatus;
  title: string;
  version: number;
}>;

export type PortalAgreementDetail = PortalAgreementSummary &
  Readonly<{
    allRequiredSignaturesRecorded: boolean;
    organisationId: string;
    requiredSigners: readonly string[];
  }>;

type AgreementStatusPresentation = Readonly<{
  description: string;
  label: string;
  tone: PortalStatus;
}>;

const statusPresentation: Record<
  PortalAgreementStatus,
  AgreementStatusPresentation
> = {
  awaiting_signature: {
    description: "The exact approved version is waiting for the required signatures.",
    label: "Awaiting signature",
    tone: "warning",
  },
  draft: {
    description: "This agreement is still being prepared and is not ready to sign.",
    label: "Draft",
    tone: "neutral",
  },
  signed: {
    description: "All required signatures have been recorded for this retained version.",
    label: "Signed and complete",
    tone: "success",
  },
  superseded: {
    description: "A newer agreement revision has replaced this version.",
    label: "Superseded",
    tone: "neutral",
  },
  voided: {
    description: "This agreement version is no longer available for signature.",
    label: "Unavailable for signing",
    tone: "error",
  },
};

export function toPortalAgreementStatus({
  allRequiredSignaturesRecorded,
  status,
}: SigningStatusInput): PortalAgreementStatus {
  if (status === "completed" && allRequiredSignaturesRecorded) {
    return "signed";
  }

  if (status === "superseded") return "superseded";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "voided";
  }

  if (status === "approved" || status === "completed") {
    return "awaiting_signature";
  }
  return "draft";
}

export function AgreementStatusCard({
  status,
}: Readonly<{
  status: PortalAgreementStatus;
}>): React.JSX.Element {
  const presentation = statusPresentation[status];

  return (
    <PortalCard description={presentation.description} title="Agreement status">
      <StatusBadge status={presentation.tone}>{presentation.label}</StatusBadge>
    </PortalCard>
  );
}
