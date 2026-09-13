"use client";

import {
  CircleCheckBig,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getPortalAccessMetrics,
  portalRoleOptions,
} from "@/lib/operations/auth/access-dashboard-metrics";
import type { PortalAccessRegister } from "@/lib/operations/auth/repository";
import { PortalInvitationDialog } from "./portal-invitation-dialog";
import styles from "./portal-access-dashboard.module.css";

type Status = {
  kind: "idle" | "pending" | "success" | "error";
  message?: string;
};

async function getRequestError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }
  return "Access could not be updated. Try again.";
}

function accessStatus(entry: PortalAccessRegister["entries"][number]): string {
  if (entry.membershipId && !entry.revokedAt) return "Active";
  if (entry.inviteClaimedAt) return "Claimed";
  if (entry.inviteExpiresAt && entry.inviteExpiresAt < new Date())
    return "Expired";
  if (entry.invitedAt) return "Invitation pending";
  return "Not invited";
}

export function PortalAccessDashboard({
  data,
  openInvitation = false,
}: {
  data: PortalAccessRegister;
  openInvitation?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const metrics = getPortalAccessMetrics(data.entries);
  const largestRoleCount = Math.max(
    ...metrics.roleCounts.map((role) => role.count),
    1,
  );

  async function revoke(
    entry: PortalAccessRegister["entries"][number],
  ): Promise<void> {
    if (!entry.membershipId || status.kind === "pending") return;
    const reviewReference = window.prompt(
      "Record the reason for removing access.",
    );
    if (!reviewReference?.trim()) return;
    setStatus({ kind: "pending" });
    try {
      const response = await fetch("/api/growth/operations/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_membership",
          organisationId: entry.organisationId,
          membershipId: entry.membershipId,
          reviewReference,
        }),
      });
      if (!response.ok) throw new Error(await getRequestError(response));
      setStatus({ kind: "success", message: "Portal access removed." });
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Access could not be removed. Try again.",
      });
    }
  }

  return (
    <section className={styles.page} aria-labelledby="portal-access-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Operations</p>
          <h1 id="portal-access-heading">Portal access</h1>
          <p>
            Invite the right client contacts, set their role, and keep a clear
            record of active access.
          </p>
        </div>
        <div className={styles.assurance}>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>Roles are enforced against the live portal membership.</span>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Portal access overview">
        <article>
          <UsersRound aria-hidden="true" size={19} />
          <p>{data.organisations.length}</p>
          <span>Client organisations</span>
        </article>
        <article>
          <CircleCheckBig aria-hidden="true" size={19} />
          <p>{metrics.active}</p>
          <span>Active members</span>
        </article>
      </section>

      <section
        className={styles.roleDistribution}
        aria-labelledby="role-distribution-heading"
      >
        <div>
          <p className={styles.eyebrow}>Access coverage</p>
          <h2 id="role-distribution-heading">Role distribution</h2>
          <p>
            Role counts are based on the accepted access records in Operations.
          </p>
        </div>
        <ul aria-label="Active members by role">
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

      <section
        className={styles.grantCard}
        aria-labelledby="portal-invitation-heading"
        id="portal-invitation"
      >
        <div className={styles.grantHeading}>
          <UserPlus aria-hidden="true" size={20} />
          <div>
            <h2 id="portal-invitation-heading">Invite portal user</h2>
            <p>
              Clerk holds the invitation until the recipient creates their
              account. The contact and membership are then written together.
            </p>
          </div>
        </div>
        <div className={styles.accessSequence}>
          <h3>How access starts</h3>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Founder approval</strong>
                <p>The review note records why the requested access is approved.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Clerk invitation</strong>
                <p>The recipient receives the role and account details to accept.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Account acceptance</strong>
                <p>Operations creates the contact and membership after setup.</p>
              </div>
            </li>
          </ol>
        </div>
        {data.organisations.length === 0 ? (
          <p className={styles.empty}>
            Create an active organisation in the client register before granting
            portal access.
          </p>
        ) : (
          <div className={styles.inviteControl}>
            <PortalInvitationDialog
              autoOpen={openInvitation}
              organisations={data.organisations}
              onInvitationSent={(message) =>
                setStatus({ kind: "success", message })
              }
            />
          </div>
        )}
        <div aria-live="polite">
          {status.message && (
            <p
              className={`${styles.message} ${status.kind === "error" ? styles.error : ""}`}
            >
              {status.message}
            </p>
          )}
        </div>
      </section>

      <section
        className={styles.register}
        aria-labelledby="access-register-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="access-register-heading">Access register</h2>
            <p>
              {data.entries.length
                ? "Every role is scoped to one client organisation."
                : "Accepted invitations will appear here once account setup is complete."}
            </p>
          </div>
        </div>
        {data.entries.length > 0 && (
          <ul>
            {data.entries.map((entry) => (
              <li key={entry.contactId} className={styles.entry}>
                <div className={styles.person}>
                  <strong>{entry.name}</strong>
                  <span>{entry.email}</span>
                  <span>{entry.organisationName}</span>
                </div>
                <div className={styles.role}>
                  {entry.role ? (
                    <>
                      <strong>
                        {
                          portalRoleOptions.find(
                            (role) => role.value === entry.role,
                          )?.label
                        }
                      </strong>
                      <span>
                        {
                          portalRoleOptions.find(
                            (role) => role.value === entry.role,
                          )?.detail
                        }
                      </span>
                    </>
                  ) : (
                    <span>Role set when invited</span>
                  )}
                </div>
                <span
                  className={
                    entry.membershipId && !entry.revokedAt
                      ? styles.active
                      : styles.pending
                  }
                >
                  {accessStatus(entry)}
                </span>
                {entry.membershipId && !entry.revokedAt ? (
                  <button
                    className={styles.revoke}
                    disabled={status.kind === "pending"}
                    onClick={() => revoke(entry)}
                    type="button"
                  >
                    Remove access
                  </button>
                ) : (
                  <span className={styles.noAction}>No active access</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
