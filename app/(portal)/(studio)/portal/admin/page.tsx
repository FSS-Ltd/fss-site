import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import styles from "@/components/portal/auth/portal.module.css";

export const dynamic = "force-dynamic";

export default async function FssStudioPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  try {
    await requireFssAdmin(getOperationsDb(), identity, randomUUID());
  } catch {
    // Keep the existing non-disclosing portal response for non-staff users.
    return <PortalUnavailable />;
  }
  return (
    <section aria-labelledby="studio-heading">
      <p className={styles.eyebrow}>FSS Studio</p>
      <h1 id="studio-heading" className={styles.heading}>Operations overview</h1>
      <p className={styles.copy}>
        A cross-client workspace for delivery, agreements, welcome journeys,
        projects, billing, notifications, and settings.
      </p>
      <div className={styles.list} role="list" aria-label="Studio work queues">
        {[
          ["Client delivery", "Requests and milestones needing operational attention."],
          ["Agreement work", "Drafts, readiness checks, signing, and retained evidence."],
          ["Welcome journeys", "Activation schedules, tasks, and recovery outcomes."],
        ].map(([title, description]) => (
          <article className={styles.row} key={title} role="listitem">
            <h2 className={styles.name}>{title}</h2>
            <p className={styles.copy}>{description}</p>
            <p className={styles.actions}><span className={styles.link}>Workspace foundation ready</span></p>
          </article>
        ))}
      </div>
    </section>
  );
}
