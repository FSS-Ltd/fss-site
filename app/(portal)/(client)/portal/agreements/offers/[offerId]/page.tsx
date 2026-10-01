import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClientCommercialOffer } from "@/components/portal/agreements/client-commercial-offer";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalCommercialOffer } from "@/lib/operations/agreements/commercial-service";
import { signingEnabled } from "@/lib/operations/agreements/signing-worker";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";
export default async function ClientOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>;
  searchParams: Promise<{ organisationId?: string | string[] }>;
}): Promise<React.JSX.Element> {
  if (!signingEnabled()) notFound();
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  const offerId = z.uuid().safeParse((await params).offerId);
  if (!offerId.success) notFound();
  let offer;
  try {
    offer = await getPortalCommercialOffer(
      getPortalDb(),
      context.identity,
      context.organisationId,
      offerId.data,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!offer) notFound();
  return (
    <>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title={offer.draft.title}
        description="Review your setup fee and available ongoing compensation choices."
        breadcrumbs={[
          {
            label: "Agreements",
            href: `${portalPath("/portal/agreements")}?organisationId=${context.organisationId}`,
          },
          { label: "Payment options" },
        ]}
      />
      <ClientCommercialOffer offer={offer} />
    </>
  );
}
