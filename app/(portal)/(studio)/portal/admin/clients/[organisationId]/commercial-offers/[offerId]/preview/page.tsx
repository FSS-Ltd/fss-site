import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CommercialOfferSummary } from "@/components/portal/agreements/commercial-offer-summary";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import {
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { formatMoney } from "@/lib/operations/money";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { getStaffCommercialOffer } from "@/lib/operations/agreements/commercial-service";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";

export default async function StaffCommercialOfferPreviewPage({
  params,
}: {
  params: Promise<{ organisationId: string; offerId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const identifiers = z
    .strictObject({ organisationId: z.uuid(), offerId: z.uuid() })
    .safeParse(await params);
  if (!identifiers.success) notFound();
  const { organisationId, offerId } = identifiers.data;
  let offer;
  try {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    offer = await getStaffCommercialOffer(
      getOperationsDb(),
      admin,
      organisationId,
      offerId,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!offer) notFound();

  const offerHref = portalPath(
    `/portal/admin/clients/${organisationId}/commercial-offers/${offerId}`,
  );
  const agreementsHref = portalPath(
    `/portal/admin/clients/${organisationId}/agreements`,
  );
  const clientOfferUrl = new URL(
    `${portalPath(`/portal/agreements/offers/${offer.id}`)}?${new URLSearchParams({ organisationId: offer.organisationId })}`,
    resolvePortalOrigin(),
  ).href;

  return (
    <div className={styles.detail}>
      <PageHeader
        action={
          <PortalActionLink href={offerHref} variant="secondary">
            Back to offer review
          </PortalActionLink>
        }
        breadcrumbs={[
          { label: "Agreements", href: agreementsHref },
          { label: "Client offer preview" },
        ]}
        description="Read-only FSS staff preview of the payment terms shown to the client. Client choices still require the client’s own authorised portal session."
        eyebrow="FSS Studio / Agreements"
        title={offer.draft.title}
      />
      <PortalCard title="Client offer status">
        <StatusBadge status="info">{offer.status}</StatusBadge>
        <p>Offer version {offer.version}</p>
        <p>Expires {new Date(offer.expiresAt).toLocaleDateString("en-GB")}</p>
      </PortalCard>
      <CommercialOfferSummary offer={offer} />
      {offer.selection ? (
        <PortalCard title="Client selection or proposal">
          <p>
            {offer.selection.option === "cash"
              ? offer.selection.recurringAmountMinor
                ? `${formatMoney(offer.selection.recurringAmountMinor, offer.draft.currency)} ${offer.draft.currency} per billing period`
                : "Fixed cash payment schedule selected"
              : offer.selection.percentageBps !== undefined
                ? `${(offer.selection.percentageBps / 100).toFixed(2)}% revenue share proposed`
                : "Fixed revenue share selected"}
          </p>
        </PortalCard>
      ) : null}
      <PortalCard title="Client offer URL">
        <p>
          Share this URL with the named client signer. It requires the client’s
          own authorised portal session and will not open as staff.
        </p>
        <p>
          <code>{clientOfferUrl}</code>
        </p>
      </PortalCard>
    </div>
  );
}
