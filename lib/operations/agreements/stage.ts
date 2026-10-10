import type { CommercialOffer } from "./commercial-types";
import { allRequiredSignaturesRecorded } from "./signing-state";
import type { SigningApproval } from "./signing-types";

export type AgreementStage =
  | "draft"
  | "budget_requested"
  | "pricing_choice_requested"
  | "proposal_submitted"
  | "approved"
  | "signatures_collected"
  | "completed"
  | "attention_required"
  | "withdrawn";

export function agreementStage(input: {
  offer?: Pick<CommercialOffer, "status" | "spec"> | null;
  signing?: Pick<
    SigningApproval,
    "status" | "requiredSigners" | "signatures" | "completionFailureCode"
  > | null;
  completeEvidence?: boolean;
}): AgreementStage {
  if (input.signing) {
    if (input.signing.status === "completed" && input.completeEvidence)
      return "completed";
    if (
      input.signing.completionFailureCode ||
      input.signing.status === "completed"
    )
      return "attention_required";
    if (
      input.signing.status === "approved" &&
      allRequiredSignaturesRecorded(input.signing)
    )
      return "signatures_collected";
    if (input.signing.status === "approved") return "approved";
    if (
      ["cancelled", "declined", "superseded", "expired"].includes(
        input.signing.status,
      )
    )
      return "withdrawn";
  }
  if (input.offer) {
    if (input.offer.status === "proposed") return "proposal_submitted";
    if (input.offer.status === "selected") return "approved";
    if (input.offer.status === "withdrawn" || input.offer.status === "expired")
      return "withdrawn";
    if (
      input.offer.status === "published" ||
      input.offer.status === "rejected"
    ) {
      return input.offer.spec.cash?.mode === "client_proposed" ||
        input.offer.spec.revenueShare?.mode === "client_proposed"
        ? "budget_requested"
        : "pricing_choice_requested";
    }
  }
  return "draft";
}

const labels: Record<
  AgreementStage,
  { staff: string; client: string; description: string }
> = {
  draft: {
    staff: "Continue editing",
    client: "Preparing agreement",
    description: "FSS is preparing the agreement.",
  },
  budget_requested: {
    staff: "Awaiting client proposal",
    client: "Propose your budget",
    description:
      "The client can review the terms and submit a budget proposal.",
  },
  pricing_choice_requested: {
    staff: "Awaiting client choice",
    client: "Choose payment terms",
    description: "The client can choose from the reviewed fixed terms.",
  },
  proposal_submitted: {
    staff: "Review client proposal",
    client: "Awaiting FSS review",
    description: "The client proposal is recorded and awaits FSS approval.",
  },
  approved: {
    staff: "Awaiting signatures",
    client: "Review and sign",
    description: "The final agreement is open for its named signers.",
  },
  signatures_collected: {
    staff: "Preparing signed copy",
    client: "Signature recorded",
    description:
      "Every required signature is recorded. The final copy is being retained.",
  },
  completed: {
    staff: "Signed, continue setup",
    client: "Signed agreement available",
    description: "The signed copy and evidence are retained.",
  },
  attention_required: {
    staff: "Document needs attention",
    client: "FSS is reviewing the document",
    description:
      "The final document needs review before it can be treated as complete.",
  },
  withdrawn: {
    staff: "Withdrawn",
    client: "Unavailable",
    description: "This request is no longer open.",
  },
};

export function stagePresentation(
  stage: AgreementStage,
  audience: "staff" | "client",
): { label: string; description: string } {
  return {
    label: labels[stage][audience],
    description: labels[stage].description,
  };
}
