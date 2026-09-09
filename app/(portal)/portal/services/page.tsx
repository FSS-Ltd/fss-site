import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { OfferList } from "@/components/portal/services/offer-list";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPublishedOffers } from "@/lib/operations/offers/repository";
import styles from "@/components/portal/projects.module.css";

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
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href="/portal">
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Services</p>
      <h1 className={styles.title}>Explore what comes next</h1>
      <p className={styles.copy}>
        Clear service options for conversations about your next outcome. Nothing
        here changes your agreement or billing until FSS prepares a proposal and
        the right people approve it.
      </p>
      <OfferList
        offers={offers}
        organisationId={context.organisationId}
        canEnquire={canEnquire}
      />
    </div>
  );
}
