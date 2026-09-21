import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientServiceCatalogue } from "@/components/portal/services/client-service-catalogue";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPublishedOffers } from "@/lib/operations/offers/repository";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let offers;
  let canEnquire: boolean;
  try {
    const db = getPortalDb();
    const correlationId = randomUUID();
    const membership = await requirePortalMember(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    offers = await listPublishedOffers(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    canEnquire = hasPortalCapability(membership.role, "offers.enquire");
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <ClientServiceCatalogue
      canEnquire={canEnquire}
      offers={offers}
      organisationId={context.organisationId}
    />
  );
}
