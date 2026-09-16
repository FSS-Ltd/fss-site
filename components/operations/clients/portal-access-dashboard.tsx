"use client";

import { ShieldCheck, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FounderAccessOverview } from "@/lib/operations/auth/founder-access";
import { PortalInvitationDialog } from "./portal-invitation-dialog";
import { PortalAccessRegister } from "./portal-access-register";
import styles from "./portal-access-dashboard.module.css";

export function PortalAccessDashboard({
  data,
}: {
  data: FounderAccessOverview;
}): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { metrics } = data;
  const largestRoleCount = Math.max(
    ...metrics.roleCounts.map((role) => role.count),
    1,
  );
  const cards = [
    ["Unique active users", metrics.uniqueActiveUsers],
    ["Active client users", metrics.clientUsers],
    ["Active FSS Admins", metrics.admins],
    ["Pending invitations", metrics.pendingInvitations],
    ["Client organisations", metrics.organisations],
  ] as const;

  return (
    <section className={styles.page} aria-labelledby="portal-access-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Growth Operations</p>
          <h1 id="portal-access-heading">Portal access</h1>
          <p>
            Invite client users and FSS Admins, review access, and see who uses
            the portal.
          </p>
        </div>
        <div className={styles.headerActions}>
          <PortalInvitationDialog
            triggerClassName={styles.primaryAction}
            onInvitationSent={(result) => {
              setMessage(result);
              router.refresh();
            }}
          />
          <div className={styles.assurance}>
            <ShieldCheck aria-hidden="true" size={20} />
            <span>Only the founder can invite users and remove access.</span>
          </div>
        </div>
      </header>
      <section className={styles.metrics} aria-label="Portal access overview">
        {cards.map(([label, count]) => (
          <article key={label}>
            <UsersRound aria-hidden="true" size={19} />
            <p>{count}</p>
            <span>{label}</span>
          </article>
        ))}
      </section>
      <section
        className={styles.roleDistribution}
        aria-labelledby="role-distribution-heading"
      >
        <div>
          <p className={styles.eyebrow}>Access coverage</p>
          <h2 id="role-distribution-heading">Role distribution</h2>
          <p>
            Unique active people per role. A person with more than one role
            appears in each relevant role total. Pending invitations exclude
            people who already have active access.
          </p>
        </div>
        <ul aria-label="Active users by role">
          {metrics.roleCounts.map((role) => (
            <li key={role.value}>
              <div>
                <span>{role.label}</span>
                <strong>{role.count}</strong>
              </div>
              <span aria-hidden="true" className={styles.roleTrack}>
                <span
                  style={{ width: `${(role.count / largestRoleCount) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div aria-live="polite">
        {message && <p className={styles.message}>{message}</p>}
      </div>
      <PortalAccessRegister
        entries={data.entries}
        onAccessChanged={() => router.refresh()}
      />
    </section>
  );
}
