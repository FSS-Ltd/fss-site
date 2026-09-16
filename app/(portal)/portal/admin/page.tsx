import Link from "next/link";
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
    <section className={styles.card} aria-labelledby="studio-heading">
      <p className={styles.eyebrow}>FSS Studio</p>
      <h1 id="studio-heading" className={styles.heading}>
        Operations overview
      </h1>
      <p className={styles.copy}>
        Work across client delivery, agreements, welcome journeys, projects,
        billing, notifications, and settings from one staff workspace.
      </p>
      <nav aria-label="FSS Studio modules">
        <ul className={styles.list}>
          <li className={styles.row}>
            <h2 className={styles.name}>Clients</h2>
            <Link className={styles.link} href="/admin/clients">
              Open client register
            </Link>
          </li>
          <li className={styles.row}>
            <h2 className={styles.name}>Delivery</h2>
            <Link className={styles.link} href="/admin/delivery">
              Open delivery workspace
            </Link>
          </li>
          <li className={styles.row}>
            <h2 className={styles.name}>Agreements and welcome</h2>
            <Link className={styles.link} href="/admin/agreements">
              Open agreement workspace
            </Link>
          </li>
        </ul>
      </nav>
      <form
        action="/api/auth/sign-out?returnTo=/login"
        className={styles.actions}
        method="post"
      >
        <button className={styles.button} type="submit">
          Sign out
        </button>
      </form>
    </section>
  );
}
