import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { listPortalSigning } from "@/lib/operations/agreements/signing-service";
import { PortalFeatureUnavailable } from "@/components/portal/auth/feature-unavailable";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { listPortalCommercialOffers } from "@/lib/operations/agreements/commercial-service";
import { CommercialOfferList } from "@/components/portal/agreements/commercial-offer-list";
import { ClientAgreementList } from "@/components/portal/agreements/client-agreement-list";
import { PageHeader } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "@/components/portal/agreements/agreements.module.css";
export const dynamic = "force-dynamic";
export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ organisationId?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  if (!signingEnabled())
    return (
      <PortalFeatureUnavailable
        feature="agreements"
        organisationId={context.organisationId}
      />
    );
  let approvals;
  let offers;
  try {
    offers = await listPortalCommercialOffers(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
    approvals = await listPortalSigning(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          { label: "Your workspace", href: portalPath("/portal") },
          { label: "Agreements" },
        ]}
        description="Know what is included, what it costs and what happens next."
        eyebrow="FSS Studio / Agreements"
        title="Your agreements"
      />
      <CommercialOfferList offers={offers} audience="client" />
      <ClientAgreementList
        email={context.identity.email}
        approvals={approvals}
        organisationId={context.organisationId}
      />
      {approvals.length === 100 ? (
        <p className={styles.muted}>
          The latest 100 signing requests are shown.
        </p>
      ) : null}
    </div>
  );
}
