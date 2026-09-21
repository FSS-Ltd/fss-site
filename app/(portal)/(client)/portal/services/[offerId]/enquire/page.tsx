import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientServiceEnquiry } from "@/components/portal/services/client-service-enquiry";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPublishedOffers } from "@/lib/operations/offers/repository";

export const dynamic = "force-dynamic";

export default async function ServiceEnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [routeParameters, query] = await Promise.all([params, searchParams]);
  const offerId = z.uuid().safeParse(routeParameters.offerId);
  if (!offerId.success) notFound();

  const context = await getPortalPageContext(query.organisationId);
  if (!context) return <PortalUnavailable />;

  let offer;
  try {
    const db = getPortalDb();
    const correlationId = randomUUID();
    const membership = await requirePortalMember(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    if (!hasPortalCapability(membership.role, "offers.enquire"))
      throw new PortalAccessDenied();
    offer = (
      await listPublishedOffers(
        db,
        context.identity,
        context.organisationId,
        correlationId,
      )
    ).find((candidate) => candidate.id === offerId.data);
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!offer) notFound();

  return (
    <ClientServiceEnquiry
      contactEmail={context.identity.email}
      offer={offer}
      organisationId={context.organisationId}
    />
  );
}
