"use client";

import { Send, UserPlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
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
  return "The invitation could not be sent. Try again.";
}

export function PortalInvitationDialog({
  onInvitationSent,
  triggerClassName,
}: {
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = form.get("email")?.toString().trim().toLowerCase();
    try {
      const response = await fetch("/api/growth/operations/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_client",
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
          reviewReference: form.get("reviewReference"),
        }),
      });
      if (!response.ok) throw new Error(await getRequestError(response));
      formElement.reset();
      setStatus({
        kind: "success",
        message: email
          ? `Invitation sent to ${email}. Their access will appear in the register once they complete setup.`
          : "Invitation sent. Their access will appear in the register once they complete setup.",
      });
      onInvitationSent(
        email ? `Invitation sent to ${email}.` : "Invitation sent.",
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
        aria-labelledby="portal-invitation-dialog-heading"
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
            <p className={styles.eyebrow}>Access invitation</p>
            <h2 id="portal-invitation-dialog-heading">Invite a user</h2>
            <p>Invite a client to begin portal onboarding.</p>
          </div>
        </div>
        <form
          className={styles.dialogForm}
          onSubmit={submit}
          aria-busy={status.kind === "pending"}
        >
          <div className={styles.clientFields}>
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
                defaultValue="owner"
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
          </div>
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
