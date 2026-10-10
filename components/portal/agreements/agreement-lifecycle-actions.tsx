"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice, PortalButton } from "@/components/portal/ui";
import type { AgreementLifecycleCommand } from "@/lib/operations/agreements/lifecycle-service";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import styles from "./agreements.module.css";

type Action = AgreementLifecycleCommand["action"];

function actionFor(
  record: AgreementRecord,
  hasSigningRequest: boolean,
): Action | null {
  if (record.archivedAt) return "restore";
  if (record.status === "signed") return "archive";
  if (record.status === "withdrawn") return null;
  return hasSigningRequest ? "withdraw" : "delete";
}

const labels: Record<Action, string> = {
  delete: "Delete draft",
  withdraw: "Withdraw agreement",
  archive: "Archive agreement",
  restore: "Restore agreement",
};

const explanations: Record<Action, string> = {
  delete:
    "This removes an unsent draft. The server will refuse deletion if any issued request, signature, billing obligation or dependent record exists.",
  withdraw:
    "This closes any open signing request. The issued document, signatures already recorded and audit history remain retained.",
  archive:
    "This hides the signed agreement from the active list. Signed evidence, services, invoices and payment schedules stay in place.",
  restore:
    "This returns the signed agreement to the active list without changing its evidence or billing.",
};

export function AgreementLifecycleActions({
  record,
  organisationId,
  hasSigningRequest,
  listHref,
}: Readonly<{
  record: AgreementRecord;
  organisationId: string;
  hasSigningRequest: boolean;
  listHref: string;
}>): React.JSX.Element | null {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = actionFor(record, hasSigningRequest);
  if (!action) return null;

  async function submit(): Promise<void> {
    if (pending || !action) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/portal/admin/clients/${organisationId}/agreements/${record.id}/lifecycle`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            expectedVersion: record.version,
          } satisfies AgreementLifecycleCommand),
        },
      );
      if (!response.ok) {
        const result: unknown = await response.json();
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "This agreement could not be updated.",
        );
      }
      dialog.current?.close();
      if (action === "delete") router.push(listHref);
      else router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "This agreement could not be updated.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PortalButton
        type="button"
        variant="secondary"
        onClick={(event) => {
          trigger.current = event.currentTarget;
          dialog.current?.showModal();
        }}
      >
        {labels[action]}
      </PortalButton>
      <dialog
        ref={dialog}
        className={styles.signingConfirmDialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => {
          trigger.current?.focus();
          setError(null);
        }}
      >
        <h2 id={`${id}-title`}>{labels[action]}?</h2>
        <p id={`${id}-description`}>{explanations[action]}</p>
        <p>
          <strong>{record.draft.title}</strong> · revision {record.revision}
        </p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className={styles.signingConfirmActions}>
          <PortalButton
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Keep agreement
          </PortalButton>
          <PortalButton
            type="button"
            variant={action === "delete" ? "destructive" : "primary"}
            loading={pending}
            onClick={() => void submit()}
          >
            Confirm {action}
          </PortalButton>
        </div>
      </dialog>
    </>
  );
}
