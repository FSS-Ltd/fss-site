import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { StudioPagination } from "@/components/portal/workspace/studio-pagination";
import { studioDateLabel } from "@/components/portal/workspace/studio-date";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listStaffBillingExceptions } from "@/lib/operations/workspaces/staff-repository";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const data = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    let enabled = false;
    try {
      enabled = readBillingConfiguration().enabled;
    } catch {
      enabled = false;
    }
    if (!enabled) return { available: false as const };
    const organisationId = Array.isArray(params.organisationId)
      ? undefined
      : params.organisationId;
    const exceptions = await listStaffBillingExceptions(db, admin, {
      organisationId,
      page: parseWorkspacePage(params.page),
    });
    return { available: true as const, exceptions, organisationId };
  })().catch(() => null);
  if (!data) return <PortalUnavailable />;
  if (!data.available) {
    return (
      <section className={styles.page} aria-labelledby="studio-billing-heading">
        <header className={styles.hero}>
          <p className={styles.eyebrow}>FSS Studio · Billing</p>
          <h1 className={styles.title} id="studio-billing-heading">
            Billing
          </h1>
          <p className={styles.description}>
            Billing is unavailable because the dedicated provider configuration
            has not been enabled for this workspace.
          </p>
        </header>
      </section>
    );
  }
  const { exceptions, organisationId } = data;
  return (
    <section className={styles.page} aria-labelledby="studio-billing-heading">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Billing</p>
        <h1 className={styles.title} id="studio-billing-heading">
          Billing review
        </h1>
        <p className={styles.description}>
          Provider-owned retries stay with Stripe. This queue identifies the
          operational follow-up that needs FSS review.
        </p>
      </header>
      {exceptions.items.length === 0 ? (
        <p className={styles.rowCopy}>
          There are no unresolved billing exceptions.
        </p>
      ) : (
        <ul className={styles.rowList}>
          {exceptions.items.map((exception) => (
            <li className={styles.row} key={exception.id}>
              <div className={styles.rowContent}>
                <h2 className={styles.rowTitle}>
                  {exception.category.replaceAll("_", " ")}
                </h2>
                <p className={styles.rowCopy}>
                  {exception.organisationName ?? "Unassigned organisation"} ·{" "}
                  {exception.mode} mode
                </p>
                <p className={styles.rowCopy}>
                  Last observed {studioDateLabel(exception.lastSeenAt)}
                </p>
              </div>
              {exception.organisationId && (
                <Link
                  className={styles.actionLink}
                  href={`/admin/clients/${exception.organisationId}`}
                >
                  Client context
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <StudioPagination
        filter={{ organisationId }}
        hasNext={exceptions.hasNext}
        page={exceptions.page}
        path="/admin/billing"
      />
    </section>
  );
}
