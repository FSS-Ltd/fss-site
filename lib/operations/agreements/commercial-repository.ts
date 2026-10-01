import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { withPortalTransaction } from "../db/portal-client";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { CommercialOffer } from "./commercial-types";

export async function loadCommercialOffers(
  tx: OperationsTransaction,
  organisationId: string,
  offerId: string | null = null,
): Promise<CommercialOffer[]> {
  return tx<
    CommercialOffer[]
  >`select id, organisation_id as "organisationId", engagement_id as "engagementId", version,
    case when status in ('published','proposed','rejected') and expires_at<=clock_timestamp() then 'expired' else status end as status,
    draft, spec, expires_at::text as "expiresAt", selection, rejection_reason as "rejectionReason", approval_id as "approvalId", agreement_id as "agreementId"
    from operations.commercial_offers where organisation_id=${organisationId} and (${offerId}::uuid is null or id=${offerId}::uuid) order by created_at desc,id limit 100`;
}
export async function listStaffCommercialOffers(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<CommercialOffer[]> {
  return withFssAdminTransaction(db, admin, (tx) =>
    loadCommercialOffers(tx, organisationId),
  );
}
export async function listPortalCommercialOffers(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<CommercialOffer[]> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    (tx) => loadCommercialOffers(tx, organisationId),
  );
}

export async function getStaffCommercialOffer(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  offerId: string,
): Promise<CommercialOffer | null> {
  return withFssAdminTransaction(
    db,
    admin,
    async (tx) =>
      (await loadCommercialOffers(tx, organisationId, offerId))[0] ?? null,
  );
}
export async function getPortalCommercialOffer(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  offerId: string,
  correlationId: string,
): Promise<CommercialOffer | null> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) =>
      (await loadCommercialOffers(tx, organisationId, offerId))[0] ?? null,
  );
}
