import { hasPortalCapability } from "../auth/permissions";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";

export type ClientSetupChecklist = {
  agreementSigned: boolean;
  billingReady: boolean;
  filesReady: boolean;
  serviceReady: boolean;
};

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
      const [checklist] = await tx<ClientSetupChecklist[]>`
        select
          agreement_signed as "agreementSigned",
          billing_ready as "billingReady",
          files_ready as "filesReady",
          service_ready as "serviceReady"
        from operations.portal_onboarding_checklist(${organisationId})
      `;
      if (!checklist) throw new PortalAccessDenied();
      return checklist;
    },
  );
}
