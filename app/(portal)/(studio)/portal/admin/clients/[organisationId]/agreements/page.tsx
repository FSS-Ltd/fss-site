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
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

export default async function StaffClientAgreementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{
    after?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const organisationId = z.uuid().safeParse((await params).organisationId);
  const query = await searchParams;
  const after = query.after;
  if (!organisationId.success || Array.isArray(after)) notFound();
  let register;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    register = await listStaffAgreementRegister(
      db,
      admin,
      organisationId.data,
      after,
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
        description="Agreement records are created only from reviewed work and a complete server-validated draft."
        eyebrow="FSS Studio / Agreements"
        title={`${register.organisationName}: agreements`}
      />
      <section
        className={styles.group}
        aria-labelledby="existing-agreements-heading"
      >
        <div className={styles.groupHeading}>
          <div>
            <h2 id="existing-agreements-heading">Existing agreement records</h2>
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
                      {record.status === "signed" ? "Signed" : "Draft"}
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
                </PortalCard>
              </li>
            ))}
          </ul>
        ) : (
          <PortalCard title="No agreement records yet">
            <p className={styles.muted}>
              Start a saved builder draft from reviewed work when you are ready.
            </p>
            <PortalActionLink href={newAgreementHref} variant="primary">
              New agreement
            </PortalActionLink>
          </PortalCard>
        )}
        {register.nextCursor ? (
          <PortalActionLink
            href={`${baseHref}?after=${encodeURIComponent(register.nextCursor)}`}
            variant="secondary"
          >
            Next agreement page
          </PortalActionLink>
        ) : null}
      </section>
    </div>
  );
}
