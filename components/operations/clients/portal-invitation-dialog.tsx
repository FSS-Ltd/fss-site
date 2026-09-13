"use client";

import { Send, UserPlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import styles from "./portal-access-dashboard.module.css";

type Status = {
  kind: "idle" | "pending" | "success" | "error";
  message?: string;
};

type Organisation = { id: string; displayName: string };

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
  return "The invitation could not be sent. Try again.";
}

export function PortalInvitationDialog({
  organisations,
  onInvitationSent,
  triggerClassName,
}: {
  organisations: readonly Organisation[];
  onInvitationSent: (message: string) => void;
  triggerClassName?: string;
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function close(): void {
    if (status.kind === "pending") return;
    dialog.current?.close();
    setStatus({ kind: "idle" });
  }

  function open(): void {
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status.kind === "pending") return;
    setStatus({ kind: "pending" });
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/growth/operations/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant_access",
          organisationId: form.get("organisationId"),
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
          reviewReference: form.get("reviewReference"),
        }),
      });
      if (!response.ok) throw new Error(await getRequestError(response));
      const email = form.get("email")?.toString().trim().toLowerCase();
      event.currentTarget.reset();
      setStatus({
        kind: "success",
        message:
          "Invitation sent. The access record will appear after the recipient creates their account.",
      });
      onInvitationSent(
        email
          ? `Invitation sent to ${email}. Access will be recorded after account creation.`
          : "Invitation sent. Access will be recorded after account creation.",
      );
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The invitation could not be sent. Check the details and try again.",
      });
    }
  }

  return (
    <>
      <button
        className={triggerClassName ?? styles.inviteButton}
        onClick={open}
        type="button"
      >
        <UserPlus aria-hidden="true" size={18} />
        Invite portal user
      </button>
      <dialog
        aria-labelledby="portal-invitation-heading"
        className={styles.dialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        ref={dialog}
      >
        <div className={styles.dialogHeader}>
          <div className={styles.dialogIcon} aria-hidden="true">
            <Send size={19} />
          </div>
          <div>
            <p className={styles.eyebrow}>Portal invitation</p>
            <h2 id="portal-invitation-heading">Invite a client user</h2>
            <p>
              Clerk sends the invitation. FSS creates the contact and role only
              after the user accepts and completes account setup.
            </p>
          </div>
        </div>
        <form
          className={styles.dialogForm}
          onSubmit={submit}
          aria-busy={status.kind === "pending"}
        >
          <label>
            Organisation
            <select
              autoFocus
              defaultValue=""
              name="organisationId"
              required
              disabled={status.kind === "pending"}
            >
              <option disabled value="">
                Choose an organisation
              </option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Client name
            <input
              maxLength={200}
              name="name"
              required
              disabled={status.kind === "pending"}
            />
          </label>
          <label>
            Email address
            <input
              autoComplete="email"
              maxLength={254}
              name="email"
              required
              type="email"
              disabled={status.kind === "pending"}
            />
          </label>
          <label>
            Portal role
            <select
              defaultValue="viewer"
              name="role"
              disabled={status.kind === "pending"}
            >
              {portalRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.dialogReference}>
            Access approval note
            <input
              maxLength={200}
              name="reviewReference"
              placeholder="Why this access is approved"
              required
              disabled={status.kind === "pending"}
            />
          </label>
          <div className={styles.dialogActions}>
            <button
              className={styles.cancelButton}
              disabled={status.kind === "pending"}
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.submitButton}
              disabled={status.kind === "pending" || status.kind === "success"}
              type="submit"
            >
              {status.kind === "pending"
                ? "Sending invitation…"
                : "Send invitation"}
            </button>
          </div>
        </form>
        <div aria-live="polite" aria-atomic="true">
          {status.message && (
            <p
              className={`${styles.message} ${status.kind === "error" ? styles.error : ""}`}
            >
              {status.message}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
