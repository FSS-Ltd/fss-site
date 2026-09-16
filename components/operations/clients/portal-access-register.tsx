"use client";

import { useState } from "react";
import {
  accessRoleOptions,
  accessStates,
  type AccessState,
  type FounderAccessEntry,
} from "@/lib/operations/auth/founder-access";
import styles from "./portal-access-dashboard.module.css";

const stateLabels: Record<AccessState, string> = {
  active: "Active",
  pending: "Invitation pending",
  revoked: "Revoked",
  expired: "Expired",
  provider_failed: "Delivery failed",
  inactive: "Organisation inactive",
};

function dateLabel(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: "Europe/London",
      }).format(new Date(value))
    : "Not yet";
}

export function PortalAccessRegister({
  entries,
  onAccessChanged,
}: {
  entries: readonly FounderAccessEntry[];
  onAccessChanged: () => void;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [accessType, setAccessType] = useState("all");
  const [state, setState] = useState("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = entries.filter(
    (entry) =>
      (accessType === "all" || entry.accessType === accessType) &&
      (state === "all" || entry.state === state) &&
      `${entry.name} ${entry.email} ${entry.organisationName ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  async function revoke(entry: FounderAccessEntry): Promise<void> {
    if (!entry.membershipId || pending) return;
    const reviewReference = window
      .prompt("Record the reason for removing access.")
      ?.trim();
    if (!reviewReference) return;
    setPending(true);
    setMessage("");
    setError(false);
    const operation =
      entry.accessType === "admin"
        ? {
            action: "revoke_admin",
            staffMembershipId: entry.membershipId,
            reviewReference,
          }
        : {
            action: "revoke_membership",
            organisationId: entry.organisationId,
            membershipId: entry.membershipId,
            reviewReference,
          };
    try {
      const response = await fetch("/api/growth/operations/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation),
      });
      if (!response.ok)
        throw new Error("Access could not be removed. Try again.");
      setMessage(`Access removed for ${entry.name}.`);
      onAccessChanged();
    } catch {
      setError(true);
      setMessage("Access could not be removed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={styles.register}
      aria-labelledby="access-register-heading"
    >
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="access-register-heading">Access register</h2>
          <p>
            Client access is scoped to an organisation. FSS Admins work across
            clients in FSS Studio.
          </p>
        </div>
      </div>
      <div className={styles.filters}>
        <label>
          Search users
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email or organisation"
          />
        </label>
        <label>
          Access type
          <select
            value={accessType}
            onChange={(event) => setAccessType(event.target.value)}
          >
            <option value="all">All access</option>
            <option value="client">Client user</option>
            <option value="admin">FSS Admin</option>
          </select>
        </label>
        <label>
          Access state
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="all">All states and history</option>
            {accessStates.map((value) => (
              <option key={value} value={value}>
                {stateLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p aria-live="polite">{filtered.length} access records</p>
      <div aria-live="polite">
        {message && (
          <p className={`${styles.message} ${error ? styles.error : ""}`}>
            {message}
          </p>
        )}
      </div>
      {filtered.length ? (
        <ul aria-busy={pending}>
          {filtered.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <div className={styles.person}>
                <strong>{entry.name}</strong>
                <span>{entry.email}</span>
                <span>
                  {entry.accessType === "admin"
                    ? "FSS Admin · All client operations"
                    : `Client user · ${entry.organisationName ?? "Organisation chosen at onboarding"}`}
                </span>
              </div>
              <div className={styles.role}>
                <strong>
                  {
                    accessRoleOptions.find((role) => role.value === entry.role)
                      ?.label
                  }
                </strong>
                <span>Invited: {dateLabel(entry.invitedAt)}</span>
                <span>Joined: {dateLabel(entry.joinedAt)}</span>
              </div>
              <span
                className={
                  entry.state === "active" ? styles.active : styles.pending
                }
              >
                {stateLabels[entry.state]}
              </span>
              {entry.membershipId &&
              (entry.state === "active" || entry.state === "inactive") ? (
                <button
                  className={styles.revoke}
                  disabled={pending}
                  onClick={() => revoke(entry)}
                  type="button"
                  aria-label={`Remove access for ${entry.name}`}
                >
                  Remove access
                </button>
              ) : (
                <span className={styles.noAction}>No active access</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {entries.length
            ? "No access records match these filters."
            : "Invitations and accepted access will appear here."}
        </p>
      )}
    </section>
  );
}
