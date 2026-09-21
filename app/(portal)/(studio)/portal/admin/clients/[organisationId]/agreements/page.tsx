import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AgreementForm } from "@/components/operations/agreements/agreement-form";
import { AgreementBuilder } from "@/components/portal/agreements/agreement-builder";
import {
  agreementBuilderSteps,
  type AgreementBuilderStep,
} from "@/components/portal/agreements/founder-agreement-fields";
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
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

function parseStep(value: string | string[] | undefined): AgreementBuilderStep {
  if (Array.isArray(value)) return "link";
  const parsed = z.enum(agreementBuilderSteps).safeParse(value);
  return parsed.success ? parsed.data : "link";
}

export default async function StaffClientAgreementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{
    after?: string | string[];
    step?: string | string[];
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
    const admin = await requireFssAdmin(db, identity, randomUUID());
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

  const apiRoot = `/api/portal/admin/clients/${organisationId.data}`;
  const engagementChoices = register.engagementChoices ?? [];
  const baseHref = `/admin/clients/${organisationId.data}/agreements`;
  const step = parseStep(query.step);

  return (
    <div className={styles.page}>
      <PageHeader
        action={
          <PortalActionLink
            href={`/admin/clients/${organisationId.data}/signing`}
            variant="secondary"
          >
            Review signing
          </PortalActionLink>
        }
        breadcrumbs={[
          { label: "Clients", href: "/admin/clients" },
          {
            label: register.organisationName,
            href: `/admin/clients/${organisationId.data}`,
          },
          { label: "Agreements" },
        ]}
        description="Create a complete validated agreement draft from reviewed client work."
        eyebrow="FSS Studio / Agreements"
        title={`${register.organisationName}: agreements`}
      />
      <AgreementBuilder
        engagementChoices={engagementChoices}
        engagementHref={`/admin/clients/${organisationId.data}/engagements/new`}
        organisationName={register.organisationName}
        step={step}
      >
        <AgreementForm
          engagementChoices={engagementChoices}
          engagementIds={register.engagementIds}
          endpoint={`${apiRoot}/agreements`}
          evidenceMode="generated"
          organisationId={organisationId.data}
        />
      </AgreementBuilder>
      <section
        className={styles.group}
        aria-labelledby="existing-agreements-heading"
      >
        <h2 id="existing-agreements-heading">Existing agreement records</h2>
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
                      : "Continue draft"}
                  </PortalActionLink>
                </PortalCard>
              </li>
            ))}
          </ul>
        ) : (
          <PortalCard title="No agreement records yet">
            <p className={styles.muted}>
              Link reviewed work and save the first complete agreement draft.
            </p>
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
