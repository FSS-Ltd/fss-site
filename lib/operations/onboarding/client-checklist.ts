import { hasPortalCapability } from "../auth/permissions";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";

export type ClientSetupChecklist = {
  agreementSigned: boolean;
  agreementState?:
    | "awaiting_signature"
    | "partially_signed"
    | "signatures_recorded"
    | "document_processing"
    | "completed"
    | "attention_required";
  billingReady: boolean;
  filesReady: boolean;
  serviceReady: boolean;
};

export async function loadClientSetupChecklist(
  tx: OperationsTransaction,
  organisationId: string,
): Promise<ClientSetupChecklist> {
  const [checklist] = await tx<ClientSetupChecklist[]>`
    select
      agreement_signed as "agreementSigned",
      billing_ready as "billingReady",
      files_ready as "filesReady",
      service_ready as "serviceReady"
    from operations.portal_onboarding_checklist(${organisationId})
  `;
  if (!checklist) throw new PortalAccessDenied();
  const [signing] = await tx<
    {
      status: string;
      requiredCount: number;
      recordedCount: number;
      completionAttempts: number;
      failureCode: string | null;
    }[]
  >`
    select status,required_count as "requiredCount",recorded_count as "recordedCount",
      completion_attempts as "completionAttempts",failure_code as "failureCode"
    from operations.portal_current_signing_progress(${organisationId})
  `;
  const agreementState: NonNullable<ClientSetupChecklist["agreementState"]> =
    checklist.agreementSigned
      ? "completed"
      : signing?.failureCode || signing?.status === "completed"
        ? "attention_required"
        : signing?.status === "approved" &&
            signing.requiredCount > 0 &&
            signing.recordedCount === signing.requiredCount
          ? signing.completionAttempts > 0
            ? "document_processing"
            : "signatures_recorded"
          : signing?.recordedCount
            ? "partially_signed"
            : "awaiting_signature";
  return { ...checklist, agreementState };
}

export async function getClientSetupChecklist(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<ClientSetupChecklist> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "onboarding.read"))
        throw new PortalAccessDenied();
      return loadClientSetupChecklist(tx, organisationId);
    },
  );
}
