"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Notice, PortalButton, PortalField } from "@/components/portal/ui";
import type { StudioPortalAccessEntry } from "@/lib/operations/studio/portal-access";
import { sendAccessOperation } from "./access-operation";
import styles from "./portal-access.module.css";

export function ResendInvitationDialog({
  entry,
  invitationId,
  kind,
  onComplete,
}: Readonly<{
  entry: StudioPortalAccessEntry;
  invitationId: string;
  kind: "client" | "staff";
  onComplete: (message: string) => void;
}>): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const reviewReference = String(
      new FormData(event.currentTarget).get("reviewReference") ?? "",
    ).trim();
    if (!reviewReference) return;
    setPending(true);
    setError(null);
    try {
      await sendAccessOperation({
        action: "resend_invitation",
        invitationId,
        kind,
        reviewReference,
      });
      setSent(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The new invitation could not be confirmed. Refresh before trying again.",
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
        variant="secondary"
      >
        Resend invitation
      </PortalButton>
      <dialog
        aria-describedby={`${id}-description`}
        aria-labelledby={`${id}-title`}
        className={styles.dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => {
          trigger.current?.focus();
          if (sent) onComplete(`New invitation requested for ${entry.name}.`);
          setSent(false);
          setError(null);
        }}
        ref={dialog}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id={`${id}-title`}>Resend invitation</h2>
            <p id={`${id}-description`}>
              A new invitation replaces this link and is valid for 30 days.
            </p>
          </div>
        </div>
        <div className={styles.dialogBody}>
          {sent ? (
            <>
              <Notice tone="success">
                The new invitation request was accepted by the provider. Email
                delivery and acceptance are not yet confirmed.
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
                <PortalButton loading={pending} type="submit">
                  Send new invitation
                </PortalButton>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
