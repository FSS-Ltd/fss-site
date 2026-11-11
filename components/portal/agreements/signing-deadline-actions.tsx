"use client";

import { useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Notice, PortalButton, PortalSelect } from "@/components/portal/ui";
import {
  signingExtensionDays,
  type SigningApproval,
} from "@/lib/operations/agreements/signing-types";
import styles from "./agreements.module.css";

/** Outcome passed to the next render through `?signing=`, since the panel unmounts once the request changes. */
export type SigningDeadlineOutcome = "reopened" | "withdrawn";

async function errorMessage(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object") {
    if ("message" in body && typeof body.message === "string")
      return body.message;
    if ("error" in body && typeof body.error === "string") return body.error;
  }
  return fallback;
}

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

/** Confirmation shown by the page after the panel's action succeeds. */
export function SigningDeadlineOutcomeNotice({
  outcome,
}: Readonly<{
  outcome: string | string[] | undefined;
}>): React.JSX.Element | null {
  if (outcome === "reopened")
    return (
      <Notice tone="success">
        <strong>Signing reopened.</strong>
        <p>
          The same document is open again and recorded signatures are kept. No
          email was sent: resend the request to outstanding signers from
          Delivery and signing.
        </p>
      </Notice>
    );
  if (outcome === "withdrawn")
    return (
      <Notice tone="success">
        <strong>Agreement withdrawn.</strong>
        <p>The signing request is closed. Its history remains available.</p>
      </Notice>
    );
  return null;
}

/** Staff recovery for a signing request whose deadline passed before every signature. */
export function SigningDeadlineActions({
  approval,
  agreement,
  organisationId,
}: Readonly<{
  approval: Pick<
    SigningApproval,
    "id" | "expiresAt" | "signatures" | "requiredSigners" | "title"
  >;
  agreement: { id: string; version: number };
  organisationId: string;
}>): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<"extend" | "withdraw" | null>(null);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const signed = approval.signatures.length;
  const required = approval.requiredSigners.length;

  async function run(
    kind: "extend" | "withdraw",
    request: () => Promise<Response>,
    fallback: string,
  ): Promise<void> {
    if (pending) return;
    const setError = kind === "extend" ? setExtendError : setWithdrawError;
    setPending(kind);
    setError(null);
    try {
      const response = await request();
      if (!response.ok) throw new Error(await errorMessage(response, fallback));
      dialog.current?.close();
      const outcome: SigningDeadlineOutcome =
        kind === "extend" ? "reopened" : "withdrawn";
      router.replace(`${pathname}?signing=${outcome}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : fallback);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={styles.deadlinePanel} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Signing deadline passed</h2>
      <p>
        The deadline was{" "}
        {approval.expiresAt ? formatDeadline(approval.expiresAt) : "not set"}.{" "}
        {signed} of {required} required{" "}
        {required === 1 ? "signature was" : "signatures were"} recorded before
        it closed. Reopen signing to keep the same document and any recorded
        signatures, or withdraw the agreement.
      </p>
      {extendError ? <Notice tone="error">{extendError}</Notice> : null}
      <form
        className={styles.deadlineForm}
        aria-busy={pending === "extend"}
        onSubmit={(event) => {
          event.preventDefault();
          const days = Number(
            new FormData(event.currentTarget).get("days") ?? 14,
          );
          void run(
            "extend",
            () =>
              fetch(`/api/portal/admin/clients/${organisationId}/signing`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  action: "extend",
                  approvalId: approval.id,
                  days,
                }),
              }),
            "Signing could not be reopened.",
          );
        }}
      >
        <PortalSelect
          label="Reopen signing for"
          name="days"
          defaultValue="14"
          disabled={pending !== null}
          hint="Measured from now. The retained document does not change."
        >
          {signingExtensionDays.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </PortalSelect>
        <div className={styles.actionRow}>
          <PortalButton
            type="submit"
            loading={pending === "extend"}
            disabled={pending === "withdraw"}
          >
            Reopen signing
          </PortalButton>
          <PortalButton
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setWithdrawError(null);
              dialog.current?.showModal();
            }}
          >
            Withdraw agreement
          </PortalButton>
        </div>
      </form>
      <dialog
        ref={dialog}
        className={styles.signingConfirmDialog}
        aria-labelledby={`${id}-withdraw-title`}
        aria-describedby={`${id}-withdraw-description`}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={`${id}-withdraw-title`}>Withdraw this agreement?</h2>
        <p id={`${id}-withdraw-description`}>
          The signing request closes for good and the agreement is marked
          withdrawn. The retained document, recorded signatures and audit
          history are kept. To continue with this client later, issue a new
          agreement or offer.
        </p>
        <p>
          <strong>{approval.title}</strong>
        </p>
        {withdrawError ? <Notice tone="error">{withdrawError}</Notice> : null}
        <div className={styles.signingConfirmActions}>
          <PortalButton
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => dialog.current?.close()}
          >
            Keep agreement
          </PortalButton>
          <PortalButton
            type="button"
            variant="destructive"
            loading={pending === "withdraw"}
            onClick={() =>
              void run(
                "withdraw",
                () =>
                  fetch(
                    `/api/portal/admin/clients/${organisationId}/agreements/${agreement.id}/lifecycle`,
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        action: "withdraw",
                        expectedVersion: agreement.version,
                      }),
                    },
                  ),
                "This agreement could not be withdrawn.",
              )
            }
          >
            Withdraw agreement
          </PortalButton>
        </div>
      </dialog>
    </section>
  );
}
