"use client";

import { Send, UserPlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import {
  createInvitationPayload,
  type InvitationType,
} from "./portal-access-form";
import { PortalInvitationFields } from "./portal-invitation-fields";
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
  organisations,
  triggerClassName,
}: {
  onInvitationSent: (message: string) => void;
  organisations: readonly { id: string; displayName: string }[];
  triggerClassName?: string;
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [invitationType, setInvitationType] =
    useState<InvitationType>("new_client");

  function close(): void {
    if (status.kind === "pending") return;
    dialog.current?.close();
    setStatus({ kind: "idle" });
    setInvitationType("new_client");
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
    try {
      const response = await fetch("/api/growth/operations/portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createInvitationPayload(form, invitationType)),
      });
      if (!response.ok) throw new Error(await getRequestError(response));
      const email = form.get("email")?.toString().trim().toLowerCase();
      formElement.reset();
      setStatus({
        kind: "success",
        message:
          invitationType === "admin"
            ? "FSS Admin invitation sent. Access starts after acceptance."
            : invitationType === "existing_client"
              ? "Client invitation sent. Access starts after acceptance."
              : "Client invitation sent. Access starts after onboarding.",
      });
      onInvitationSent(
        email
          ? `Invitation sent to ${email}.`
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
            <p>
              Invite a new client owner, an existing client user, or an FSS
              colleague.
            </p>
          </div>
        </div>
        <form
          className={styles.dialogForm}
          onSubmit={submit}
          aria-busy={status.kind === "pending"}
        >
          <label className={styles.invitationType}>
            Invitation type
            <select
              autoFocus
              name="invitationType"
              value={invitationType}
              onChange={(event) => {
                const type = event.target.value;
                setInvitationType(
                  type === "admin" || type === "existing_client"
                    ? type
                    : "new_client",
                );
                setStatus({ kind: "idle" });
              }}
              disabled={status.kind === "pending"}
            >
              <option value="new_client">New client owner</option>
              <option value="existing_client">Existing client user</option>
              <option value="admin">FSS Admin</option>
            </select>
          </label>
          <PortalInvitationFields
            type={invitationType}
            organisations={organisations}
            pending={status.kind === "pending"}
          />
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
