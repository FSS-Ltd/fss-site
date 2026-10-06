"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Notice, PortalButton, PortalField } from "@/components/portal/ui";
import type { StudioPortalAccessEntry } from "@/lib/operations/studio/portal-access";
import { sendAccessOperation } from "./access-operation";
import styles from "./portal-access.module.css";

function invitationTarget(
  id: string,
): { kind: "client" | "staff" | "legacy"; invitationId: string } | null {
  const [prefix, invitationId] = id.split(":");
  const kind =
    prefix === "client-invitation"
      ? "client"
      : prefix === "legacy-invitation"
        ? "legacy"
        : prefix === "staff"
          ? "staff"
          : null;
  return kind && invitationId ? { kind, invitationId } : null;
}

export function DeleteInvitationDialog({
  entry,
  onComplete,
}: Readonly<{
  entry: StudioPortalAccessEntry;
  onComplete: (message: string) => void;
}>): React.JSX.Element | null {
  const target = invitationTarget(entry.id);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  if (!target) return null;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending || !target) return;
    const reviewReference = String(
      new FormData(event.currentTarget).get("reviewReference") ?? "",
    ).trim();
    if (!reviewReference) return;
    setPending(true);
    setError(null);
    try {
      await sendAccessOperation({
        action: "delete_invitation",
        ...target,
        reviewReference,
      });
      setSuccess(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The invitation could not be deleted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PortalButton
        onClick={(event) => {
          trigger.current = event.currentTarget;
          dialog.current?.showModal();
        }}
        type="button"
        variant="quiet"
      >
        Delete invitation
      </PortalButton>
      <dialog
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className={styles.dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => {
          trigger.current?.focus();
          if (success) onComplete(`Invitation deleted for ${entry.name}.`);
          setSuccess(false);
          setError(null);
        }}
        ref={dialog}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id={`${id}-title`}>Delete invitation</h2>
            <p id={`${id}-description`}>
              Review the recipient before removing this invitation from the
              register.
            </p>
          </div>
        </div>
        <div className={styles.dialogBody}>
          {success ? (
            <>
              <Notice tone="success">
                Invitation deleted. Its audit history remains available.
              </Notice>
              <PortalButton
                onClick={() => dialog.current?.close()}
                type="button"
              >
                Done
              </PortalButton>
            </>
          ) : (
            <form
              aria-busy={pending}
              className={styles.dialogForm}
              onSubmit={submit}
            >
              <div className={styles.target}>
                <strong>{entry.name}</strong>
                <p>{entry.email}</p>
                <p>{entry.organisationName ?? "New client"}</p>
              </div>
              <Notice tone="warning">
                {entry.state === "pending"
                  ? "The pending invitation will be revoked before it is removed."
                  : "This invitation will leave the register. Its audit record will remain."}
              </Notice>
              <PortalField label="Review reference" required>
                <input
                  disabled={pending}
                  maxLength={200}
                  name="reviewReference"
                  required
                />
              </PortalField>
              {error ? <Notice tone="error">{error}</Notice> : null}
              <div className={styles.dialogActions}>
                <PortalButton
                  disabled={pending}
                  onClick={() => dialog.current?.close()}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </PortalButton>
                <PortalButton
                  loading={pending}
                  type="submit"
                  variant="destructive"
                >
                  Confirm deletion
                </PortalButton>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
