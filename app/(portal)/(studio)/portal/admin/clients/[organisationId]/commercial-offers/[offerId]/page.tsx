import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffCommercialOffer } from "@/components/portal/agreements/staff-commercial-offer";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getStaffCommercialOffer } from "@/lib/operations/agreements/commercial-service";
import { listStaffOfferDeliveries } from "@/lib/operations/agreements/agreement-notification-repository";
import { signingEnabled } from "@/lib/operations/agreements/signing-worker";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";
export default async function StaffOfferPage({
  params,
}: {
  params: Promise<{ organisationId: string; offerId: string }>;
}): Promise<React.JSX.Element> {
  if (!signingEnabled()) notFound();
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const identifiers = z
    .strictObject({ organisationId: z.uuid(), offerId: z.uuid() })
    .safeParse(await params);
  if (!identifiers.success) notFound();
  const { organisationId, offerId } = identifiers.data;
  let offer;
  let deliveries;
  try {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    const db = getOperationsDb();
    offer = await getStaffCommercialOffer(db, admin, organisationId, offerId);
    deliveries = await listStaffOfferDeliveries(
      db,
      admin,
      organisationId,
      offerId,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!offer) notFound();
  return (
    <>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title={offer.draft.title}
        description="Published payment options and client proposal review."
        breadcrumbs={[
          {
            label: "Agreements",
            href: portalPath(
              `/portal/admin/clients/${organisationId}/agreements`,
            ),
          },
          { label: "Payment offer" },
        ]}
      />
      <StaffCommercialOffer offer={offer} deliveries={deliveries} />
    </>
  );
}
