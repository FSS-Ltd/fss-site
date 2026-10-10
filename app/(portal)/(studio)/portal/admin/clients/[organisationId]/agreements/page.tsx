import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import {
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffCommercialOffers } from "@/lib/operations/agreements/commercial-service";
import { signingEnabled } from "@/lib/operations/agreements/signing-worker";
import { CommercialOfferList } from "@/components/portal/agreements/commercial-offer-list";
import { AgreementLifecycleActions } from "@/components/portal/agreements/agreement-lifecycle-actions";
import { SavedAgreementDrafts } from "@/components/portal/agreements/saved-agreement-drafts";
import { listStaffAgreementBuilderDrafts } from "@/lib/operations/agreements/builder-draft-repository";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import type { CommercialOffer } from "@/lib/operations/agreements/commercial-types";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

export default async function StaffClientAgreementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{
    after?: string | string[];
    draftPage?: string | string[];
    view?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const organisationId = z.uuid().safeParse((await params).organisationId);
  const query = await searchParams;
  const after = query.after;
  const archived = query.view === "archived";
  if (
    !organisationId.success ||
    Array.isArray(after) ||
    Array.isArray(query.view) ||
    (query.view && !archived)
  )
    notFound();
  let draftPage;
  try {
    draftPage = parseWorkspacePage(query.draftPage);
  } catch {
    notFound();
  }
  let savedDrafts;
  let register;
  let offers: CommercialOffer[] = [];
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    if (!archived)
      savedDrafts = await listStaffAgreementBuilderDrafts(
        db,
        admin,
        organisationId.data,
        draftPage,
      );
    if (signingEnabled() && !archived)
      offers = await listStaffCommercialOffers(db, admin, organisationId.data);
    register = await listStaffAgreementRegister(
      db,
      admin,
      organisationId.data,
      after,
      archived,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!register) notFound();

  const baseHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements`,
  );
  const newAgreementHref = `${baseHref}/new`;
  const signingHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/signing`,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        action={
          <PortalActionLink href={newAgreementHref} variant="primary">
            New agreement
          </PortalActionLink>
        }
        breadcrumbs={[
          { label: "Clients", href: portalPath("/portal/admin/clients") },
          {
            label: register.organisationName,
            href: portalPath(`/portal/admin/clients/${organisationId.data}`),
          },
          { label: "Agreements" },
        ]}
        description="Create agreements from reviewed work, then prepare and review their signing documents in the signing workspace."
        eyebrow="FSS Studio / Agreements"
        title={`${register.organisationName}: agreements`}
      />
      {!archived && savedDrafts ? (
        <SavedAgreementDrafts
          drafts={savedDrafts}
          builderHref={newAgreementHref}
          listHref={
            after ? `${baseHref}?after=${encodeURIComponent(after)}` : baseHref
          }
        />
      ) : null}
      {!archived ? (
        <CommercialOfferList offers={offers} audience="staff" />
      ) : null}
      <PortalActionLink
        href={archived ? baseHref : `${baseHref}?view=archived`}
        variant="secondary"
      >
        {archived ? "View active agreements" : "View archived agreements"}
      </PortalActionLink>
      <section
        className={styles.group}
        aria-labelledby="existing-agreements-heading"
      >
        <div className={styles.groupHeading}>
          <div>
            <h2 id="existing-agreements-heading">
              {archived ? "Archived agreements" : "Active agreement records"}
            </h2>
            <p>
              Drafts and signed records remain separate from the builder
              workspace.
            </p>
          </div>
          <PortalActionLink href={signingHref} variant="secondary">
            Review signing
          </PortalActionLink>
        </div>
        {register.agreements.length ? (
          <ul className={styles.agreementList}>
            {register.agreements.map((record) => (
              <li key={`${record.id}-${record.version}`}>
                <PortalCard className={styles.listCard}>
                  <div className={styles.cardHeading}>
                    <div>
                      <p className={styles.version}>
                        Revision {record.revision}
                      </p>
                      <h3>{record.draft.title}</h3>
                    </div>
                    <StatusBadge
                      status={
                        record.status === "signed" ? "success" : "warning"
                      }
                    >
                      {record.archivedAt
                        ? "Archived"
                        : record.status === "signed"
                          ? "Signed"
                          : record.status === "withdrawn"
                            ? "Withdrawn"
                            : "Draft"}
                    </StatusBadge>
                  </div>
                  <p className={styles.muted}>{record.draft.scope}</p>
                  <PortalActionLink
                    href={`${baseHref}/${record.id}`}
                    variant={
                      record.status === "signed" ? "secondary" : "primary"
                    }
                  >
                    {record.status === "signed"
                      ? "View agreement"
                      : "Review agreement"}
                  </PortalActionLink>
                  <AgreementLifecycleActions
                    record={record}
                    organisationId={organisationId.data}
                    hasSigningRequest={Boolean(record.hasSigningRequest)}
                    listHref={baseHref}
                  />
                </PortalCard>
              </li>
            ))}
          </ul>
        ) : (
          <PortalCard
            title={
              archived ? "No archived agreements" : "No agreement records yet"
            }
          >
            <p className={styles.muted}>
              {archived
                ? "Signed agreements you archive will appear here."
                : "Start a saved builder draft from reviewed work when you are ready."}
            </p>
            {!archived ? (
              <PortalActionLink href={newAgreementHref} variant="primary">
                New agreement
              </PortalActionLink>
            ) : null}
          </PortalCard>
        )}
        {register.nextCursor ? (
          <PortalActionLink
            href={`${baseHref}?${archived ? "view=archived&" : ""}after=${encodeURIComponent(register.nextCursor)}`}
            variant="secondary"
          >
            Next agreement page
          </PortalActionLink>
        ) : null}
      </section>
    </div>
  );
}
