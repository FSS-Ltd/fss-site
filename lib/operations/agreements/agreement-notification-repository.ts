import type { OperationsDb } from "../db/client";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";

export type NotificationDelivery = Readonly<{
  id: string;
  recipient: string;
  sendVersion: number;
  status:
    | "queued"
    | "sending"
    | "sent"
    | "delivered"
    | "failed"
    | "unknown"
    | "suppressed";
}>;
export type AgreementDeliveryStatus = NotificationDelivery &
  Readonly<{ approvalId: string }>;
export type OfferDeliveryStatus = NotificationDelivery &
  Readonly<{ offerId: string }>;

export async function listStaffAgreementDeliveries(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<AgreementDeliveryStatus[]> {
  return withFssAdminTransaction(
    db,
    admin,
    (tx) => tx<AgreementDeliveryStatus[]>`
    select distinct on (approval_id,recipient)
      id,approval_id as "approvalId",recipient,send_version as "sendVersion",status
    from operations.agreement_notifications
    where organisation_id=${organisationId} and approval_id is not null
    order by approval_id,recipient,created_at desc,id desc
  `,
  );
}

export async function listStaffOfferDeliveries(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  offerId: string,
): Promise<OfferDeliveryStatus[]> {
  return withFssAdminTransaction(
    db,
    admin,
    (tx) => tx<OfferDeliveryStatus[]>`
    select id,offer_id as "offerId",recipient,send_version as "sendVersion",status
    from operations.agreement_notifications
    where organisation_id=${organisationId} and offer_id=${offerId}
    order by recipient
  `,
  );
}
