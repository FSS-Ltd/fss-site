import Link from "next/link";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import {
  listPortalMemberships,
  type PortalMembershipSummary,
} from "@/lib/operations/auth/require-member";
import type {
  PortalRole,
  VerifiedPortalIdentity,
} from "@/lib/operations/auth/types";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/auth/portal.module.css";

const roleLabels: Record<PortalRole, string> = {
  owner: "Owner",
  contributor: "Contributor",
  billing_contact: "Billing contact",
  viewer: "Viewer",
};
export default async function PortalHomePage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  let identity: VerifiedPortalIdentity | null;
  try {
    identity = await getPortalIdentity();
  } catch {
    return <PortalUnavailable />;
  }
  if (!identity) redirect("/portal/login");
  let memberships: PortalMembershipSummary[];
  try {
    memberships = await listPortalMemberships(
      getPortalDb(),
      identity,
      randomUUID(),
    );
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <section className={styles.card} aria-labelledby="portal-heading">
      <p className={styles.eyebrow}>Your account</p>
      <h1 id="portal-heading" className={styles.heading}>
        {memberships.length ? "Your organisations" : "No active access"}
      </h1>
      <p className={styles.copy}>
        {memberships.length
          ? "Your approved organisation access is listed below."
          : "You are signed in, but there is no active organisation linked to this account. Open your invitation to activate access, or contact your FSS team."}
      </p>
      {memberships.length > 0 && (
        <ul className={styles.list}>
          {memberships.map((membership) => (
            <li key={membership.organisationId} className={styles.row}>
              <h2 className={styles.name}>{membership.displayName}</h2>
              <p className={styles.copy}>{roleLabels[membership.role]}</p>
              {hasPortalCapability(membership.role, "projects.read") && (
                <p className={styles.actions}>
                  <Link
                    className={styles.link}
                    href={`/portal/projects?organisationId=${membership.organisationId}`}
                  >
                    View projects
                  </Link>
                  {" · "}
                  <Link
                    className={styles.link}
                    href={`/portal/requests?organisationId=${membership.organisationId}`}
                  >
                    View requests
                  </Link>
                </p>
              )}
              {process.env.OPERATIONS_SIGNING_ENABLED === "true" && (
                <p className={styles.actions}>
                  <Link
                    className={styles.link}
                    href={`/portal/agreements?organisationId=${membership.organisationId}`}
                  >
                    View agreements
                  </Link>
                </p>
              )}
              {process.env.OPERATIONS_BILLING_ENABLED === "true" &&
                hasPortalCapability(membership.role, "billing.read") && (
                  <p className={styles.actions}>
                    <Link
                      className={styles.link}
                      href={`/portal/billing?organisationId=${membership.organisationId}`}
                    >
                      View billing
                    </Link>
                  </p>
                )}
              {hasPortalCapability(membership.role, "offers.read") && (
                <p className={styles.actions}>
                  <Link
                    className={styles.link}
                    href={`/portal/services?organisationId=${membership.organisationId}`}
                  >
                    Explore services
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        method="post"
        action="/portal/auth/logout"
        className={styles.actions}
      >
        <button className={styles.button} type="submit">
          Sign out
        </button>
      </form>
    </section>
  );
}
