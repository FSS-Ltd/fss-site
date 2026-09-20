import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";

export const dynamic = "force-dynamic";

function billingAvailable(): boolean {
  try {
    return readBillingConfiguration().enabled;
  } catch {
    return false;
  }
}

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  try {
    await requireFssAdmin(getOperationsDb(), identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  const gates = [
    [
      "Billing",
      billingAvailable(),
      "Stripe-backed invoices and payment management.",
    ],
    [
      "Agreement signing",
      process.env.OPERATIONS_SIGNING_ENABLED === "true",
      "Verified signing and immutable signature evidence.",
    ],
    [
      "Welcome journeys",
      onboardingEnabled(),
      "Scheduled welcome messages and recovery processing.",
    ],
    [
      "Request email delivery",
      process.env.OPERATIONS_REQUEST_EMAILS_ENABLED === "true",
      "Provider-backed request review and completion email.",
    ],
  ] as const;
  return (
    <section className={styles.page} aria-labelledby="studio-settings-heading">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Settings</p>
        <h1 className={styles.title} id="studio-settings-heading">
          Workspace availability
        </h1>
        <p className={styles.description}>
          Provider gates are deployment-managed. FSS Admins can see availability
          but cannot activate providers or change access from Studio.
        </p>
      </header>
      <ul className={styles.rowList}>
        {gates.map(([name, enabled, detail]) => (
          <li className={styles.row} key={name}>
            <div className={styles.rowContent}>
              <h2 className={styles.rowTitle}>{name}</h2>
              <p className={styles.rowCopy}>{detail}</p>
            </div>
            <span className={styles.unavailable}>
              {enabled ? "Available" : "Unavailable"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
