"use client";

import {
  BarChart3,
  CircleCheckBig,
  Clock3,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  getPortalAccessMetrics,
  portalRoleOptions,
} from "@/lib/operations/auth/access-dashboard-metrics";
import type { PortalAccessRegister } from "@/lib/operations/auth/repository";
import { createGrantAccessPayload } from "./portal-access-form";
import { PortalRolePicker } from "./portal-role-picker";
import styles from "./portal-access-dashboard.module.css";

type Status = {
  kind: "idle" | "pending" | "success" | "error";
  message?: string;
};

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
}: {
  data: PortalAccessRegister;
}): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [formVersion, setFormVersion] = useState(0);
  const organisationSelectRef = useRef<HTMLSelectElement>(null);
  const metrics = getPortalAccessMetrics(data.entries);
  const largestRoleCount = Math.max(
    ...metrics.roleCounts.map((role) => role.count),
    1,
  );

  function focusInvitationForm(): void {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    document.getElementById("portal-invitation")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    organisationSelectRef.current?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status.kind === "pending") return;
    setStatus({ kind: "pending" });
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/growth/operations/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createGrantAccessPayload(form)),
      });
      if (!response.ok) throw new Error("Request failed.");
      formElement.reset();
      setFormVersion((version) => version + 1);
      setStatus({
        kind: "success",
        message:
          "Invitation issued. Clerk will send the client a secure activation email.",
      });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message:
          "Access could not be granted. Check the details and try again.",
      });
    }
  }

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
      if (!response.ok) throw new Error("Request failed.");
      setStatus({ kind: "success", message: "Portal access removed." });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Access could not be removed. Try again.",
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
        <div className={styles.headerActions}>
          <button
            className={styles.primaryAction}
            onClick={focusInvitationForm}
            type="button"
          >
            <UserPlus aria-hidden="true" size={18} />
            Invite portal user
          </button>
          <div className={styles.assurance}>
            <ShieldCheck aria-hidden="true" size={20} />
            <span>Roles are enforced against the live portal membership.</span>
          </div>
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
        <article>
          <Clock3 aria-hidden="true" size={19} />
          <p>{metrics.pending}</p>
          <span>Invitations pending</span>
        </article>
        <article>
          <BarChart3 aria-hidden="true" size={19} />
          <p>{metrics.claimed}</p>
          <span>Awaiting activation</span>
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
            Role counts come from the Operations access register, including
            pending invitations.
          </p>
        </div>
        <ul aria-label="Members and invitations by role">
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
              Choose a client, assign the database role, then send the
              activation email. The role is written to Operations records before
              Clerk delivers the activation email.
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
                <p>The client contact and review note record the decision.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Operations role record</strong>
                <p>The selected database role sets the access boundary.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Clerk sends the activation email</strong>
                <p>The approved contact activates a verified account.</p>
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
          <form
            className={styles.form}
            onSubmit={submit}
            aria-busy={status.kind === "pending"}
          >
            <label>
              Organisation
              <select
                defaultValue=""
                name="organisationId"
                ref={organisationSelectRef}
                required
              >
                <option disabled value="">
                  Choose an organisation
                </option>
                {data.organisations.map((organisation) => (
                  <option key={organisation.id} value={organisation.id}>
                    {organisation.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client name
              <input maxLength={200} name="name" required />
            </label>
            <label>
              Email address
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
            <div className={styles.rolePicker}>
              <PortalRolePicker
                defaultValue="viewer"
                disabled={status.kind === "pending"}
                key={formVersion}
                name="role"
                options={portalRoleOptions}
              />
            </div>
            <label className={styles.reference}>
              Review note
              <input
                maxLength={200}
                name="reviewReference"
                placeholder="Why this access is approved"
                required
              />
            </label>
            <button disabled={status.kind === "pending"} type="submit">
              {status.kind === "pending"
                ? "Granting access…"
                : "Send invitation"}
            </button>
          </form>
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
                : "No client contacts have been added yet."}
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
