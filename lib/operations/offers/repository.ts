import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { Offer, OfferEnquiry } from "./types";

export async function listPublishedOffers(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<Offer[]> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) => {
      const rows = await tx<
        Offer[]
      >`select id,name,outcome,audience,inclusions,exclusions,setup_needs as "setupNeeds",support_hours as "supportHours",pricing_display as "pricingDisplay",price_pence::text as "pricePence",recurrence from operations.offers where status='published' order by name,id limit 100`;
      return [...rows];
    },
  );
}

export async function insertOfferEnquiry(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  enquiry: OfferEnquiry,
): Promise<string> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) => {
      const [row] = await tx<
        { id: string }[]
      >`select operations.create_offer_enquiry(${organisationId},${enquiry.offerId},${enquiry.idempotencyKey},${enquiry.interest},${tx.json(enquiry.context)}) as id`;
      return row.id;
    },
  );
}
