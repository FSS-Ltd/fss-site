"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Notice, PortalButton, PortalField } from "@/components/portal/ui";
import { type PortalRole } from "@/lib/operations/auth/types";
import type { StaffPortalAccessOperation } from "@/lib/operations/studio/portal-access";
import {
  AccessDialogFields,
  type AccessDialogTarget,
} from "./access-dialog-fields";
import { sendAccessOperation } from "./access-operation";
import styles from "./portal-access.module.css";

type DialogProps = AccessDialogTarget &
  Readonly<{ onComplete: (message: string) => void }>;

export function AccessDialog(props: DialogProps): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<PortalRole>("contributor");
  const [formKey, setFormKey] = useState(0);
  const removing = props.kind === "remove";
  const title = removing
    ? "Remove access"
    : props.kind === "staff"
      ? "Invite FSS staff"
      : "Invite client";
  const available = props.kind !== "client" || props.contacts.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const reviewReference = String(form.get("reviewReference") ?? "").trim();
    let operation: StaffPortalAccessOperation;
    if (props.kind === "client") {
      const contact = props.contacts.find(
        (item) => item.id === form.get("contact"),
      );
      if (!contact) {
        setError("Choose an active client contact.");
        return;
      }
      operation = {
        action: "invite_existing_client",
        contactId: contact.id,
        organisationId: contact.organisationId,
        reviewReference,
        role,
      };
    } else if (props.kind === "staff") {
      operation = {
        action: "invite_admin",
        name: String(form.get("name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        reviewReference,
      };
    } else if (props.entry.accessType === "admin" && props.entry.membershipId) {
      operation = {
        action: "revoke_admin",
        staffMembershipId: props.entry.membershipId,
        reviewReference,
      };
    } else if (props.entry.membershipId && props.entry.organisationId) {
      operation = {
        action: "revoke_membership",
        membershipId: props.entry.membershipId,
        organisationId: props.entry.organisationId,
        reviewReference,
      };
    } else {
      setError(
        "This active membership is no longer available. Refresh before trying again.",
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await sendAccessOperation(operation);
      const message = removing
        ? `Access removed for ${props.entry.name}.`
        : "Invitation request accepted by the provider. Access begins after the recipient accepts it.";
      setSuccess(message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Access could not be updated.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PortalButton
        disabled={!available}
        disabledReason={
          !available ? "No active client contacts are available." : undefined
        }
        onClick={(event) => {
          trigger.current = event.currentTarget;
          dialog.current?.showModal();
        }}
        type="button"
        variant={removing ? "quiet" : "primary"}
      >
        {title}
      </PortalButton>
      <dialog
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className={styles.dialog}
        ref={dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => {
          setError(null);
          setSuccess(null);
          setRole("contributor");
          setFormKey((key) => key + 1);
          trigger.current?.focus();
          if (success) props.onComplete(success);
        }}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            <p id={`${id}-description`}>
              {removing
                ? "Review the person and scope before removing their active membership."
                : "Review the recipient, permissions and audit reference before requesting an invitation."}
            </p>
          </div>
          <button
            aria-label={`Close ${title.toLowerCase()}`}
            className={styles.close}
            disabled={pending}
            onClick={() => dialog.current?.close()}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className={styles.dialogBody}>
          {success ? (
            <>
              <Notice tone="success">{success}</Notice>
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
              key={formKey}
              onSubmit={submit}
            >
              <AccessDialogFields
                target={props}
                pending={pending}
                role={role}
                setRole={setRole}
              />
              <PortalField
                hint="Stored with the access audit. Use your reviewed decision or ticket reference."
                label="Review reference"
                required
              >
                <input
                  disabled={pending}
                  maxLength={200}
                  name="reviewReference"
                />
              </PortalField>
              {!removing ? (
                <p className={styles.detail}>
                  <strong>Provider acceptance.</strong> A successful request
                  confirms provider acceptance, not email delivery, reading or
                  invitation acceptance.
                </p>
              ) : (
                <Notice tone="warning">
                  {props.entry.accessType === "admin"
                    ? "This removes the staff grant and revokes its invitation. Client memberships remain separate."
                    : "This person will lose access to this organisation workspace. Their memberships in other organisations remain separate."}
                </Notice>
              )}
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
                  variant={removing ? "destructive" : "primary"}
                >
                  {removing ? "Confirm removal" : "Request invitation"}
                </PortalButton>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
