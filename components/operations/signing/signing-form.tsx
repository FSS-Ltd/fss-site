"use client";
import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  SIGNING_CONSENT,
  type SigningApproval,
} from "@/lib/operations/agreements/signing-types";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalCheckbox,
  PortalField,
} from "@/components/portal/ui";
import styles from "../agreements/agreements.module.css";

export function SigningForm({
  organisationId,
  approval,
  audience,
  agreement,
  commandEndpoint,
  successRedirect,
}: {
  organisationId: string;
  approval?: SigningApproval;
  audience: "founder" | "staff" | "portal";
  agreement?: { id: string; version: number };
  commandEndpoint?: string;
  successRedirect?: string;
}): React.JSX.Element {
  const router = useRouter();
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirmAction, setConfirmAction] = useState<
    "cancel" | "decline" | null
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isDeclineConfirmation =
    confirmAction === "decline" ||
    (confirmAction === null && audience === "portal");

  function openConfirmation(
    action: "cancel" | "decline",
    event: MouseEvent<HTMLButtonElement>,
  ): void {
    triggerRef.current = event.currentTarget;
    setConfirmAction(action);
    dialogRef.current?.showModal();
  }

  async function execute(action: string, data: FormData): Promise<void> {
    if (pending) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const command =
        action === "prepare"
          ? {
              action,
              agreementId: agreement?.id,
              expectedVersion: agreement?.version,
            }
          : action === "cancel"
            ? { action, approvalId: approval?.id }
            : {
                action,
                approvalId: approval?.id,
                approvalHash: approval?.approvalHash,
                ...(action === "approve"
                  ? {
                      expiresAt: new Date(
                        `${String(data.get("expiresAt"))}T23:59:59.000Z`,
                      ).toISOString(),
                    }
                  : {}),
                ...(action === "sign"
                  ? {
                      typedName: String(data.get("typedName")),
                      authority: data.get("authority") === "on",
                      consent: data.get("consent") === "on",
                    }
                  : {}),
              };
      const endpoint =
        commandEndpoint ??
        `${audience === "portal" ? "/api/portal/organisations" : "/api/growth/operations/clients"}/${organisationId}/signing`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : "We could not confirm the result. Refresh before trying again.";
        throw new Error(message);
      }
      setSuccess(
        action === "sign"
          ? "Your signature has been recorded. Final documents will be available after all required signatures are processed."
          : action === "cancel"
            ? "Signing request cancelled."
            : action === "decline"
              ? "Agreement declined. FSS will need to prepare a new revision before signing can continue."
              : "Agreement updated.",
      );
      if (action === "prepare")
        router.push(
          successRedirect ??
            `/growth/operations/clients/${organisationId}/signing`,
        );
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We could not confirm the result. Refresh before trying again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action =
      submitter instanceof HTMLButtonElement ? submitter.value : "";
    if (action) await execute(action, new FormData(event.currentTarget));
  }
  return (
    <>
      <form aria-busy={pending} onSubmit={submit} className={styles.form}>
        {agreement ? (
          <>
            <p>
              Prepare a frozen PDF from this revision, then review it before
              opening it for signing.
            </p>
            <PortalButton loading={pending} type="submit" value="prepare">
              Prepare signing document
            </PortalButton>
          </>
        ) : audience !== "portal" ? (
          <>
            {approval?.status === "prepared" && (
              <>
                <PortalField
                  hint="Choose a future date within the next 90 days. Signing closes at 23:59 UTC on that date."
                  label="Signing deadline"
                  required
                >
                  <input
                    name="expiresAt"
                    type="date"
                    required
                    disabled={pending}
                  />
                </PortalField>
                <PortalCheckbox
                  disabled={pending}
                  label="I have reviewed this exact document and its required signers. I approve it for electronic signing as an ordinary service agreement."
                  required
                />
                <PortalButton loading={pending} type="submit" value="approve">
                  Approve and open for signing
                </PortalButton>
              </>
            )}
            {(approval?.status === "prepared" ||
              (approval?.status === "approved" &&
                approval.signatures.length <
                  approval.requiredSigners.length)) && (
              <PortalButton
                disabled={pending}
                onClick={(event) => openConfirmation("cancel", event)}
                type="button"
                variant="destructive"
              >
                Cancel signing
              </PortalButton>
            )}
          </>
        ) : (
          <>
            <PortalField
              hint="Use the name you are authorised to sign with."
              label="Full legal name"
              required
            >
              <input
                name="typedName"
                autoComplete="name"
                minLength={2}
                maxLength={200}
                required
                disabled={pending || Boolean(success)}
              />
            </PortalField>
            <PortalCheckbox
              disabled={pending || Boolean(success)}
              label="I have authority to bind the named organisation."
              name="authority"
              required
            />
            <PortalCard
              description="Confirming records your consent only after the approved signing command succeeds."
              title="Confirm your agreement"
            >
              <PortalCheckbox
                disabled={pending || Boolean(success)}
                label={SIGNING_CONSENT}
                name="consent"
                required
              />
              <PortalButton
                disabled={pending || Boolean(success)}
                loading={pending}
                type="submit"
                value="sign"
              >
                Sign agreement
              </PortalButton>
            </PortalCard>
            <PortalCard
              description="Declining closes this signing request for everyone. Contact your FSS team to discuss revised terms."
              title="Need a revised agreement?"
            >
              <PortalButton
                disabled={pending || Boolean(success)}
                onClick={(event) => openConfirmation("decline", event)}
                type="button"
                variant="destructive"
              >
                Decline agreement
              </PortalButton>
            </PortalCard>
          </>
        )}
        {error ? (
          audience === "portal" ? (
            <Notice tone="error">
              <strong>We could not complete this signing step.</strong>
              <p>{error}</p>
            </Notice>
          ) : (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )
        ) : null}
        {success ? (
          audience === "portal" ? (
            <Notice tone="success">
              <strong>{success}</strong>
            </Notice>
          ) : (
            <p role="status">{success}</p>
          )
        ) : null}
      </form>
      <dialog
        aria-describedby={`${dialogId}-description`}
        aria-labelledby={`${dialogId}-title`}
        className={styles.signingConfirmDialog}
        onClose={() => {
          triggerRef.current?.focus();
          setConfirmAction(null);
        }}
        ref={dialogRef}
      >
        <h2 id={`${dialogId}-title`}>
          {isDeclineConfirmation
            ? "Decline agreement?"
            : "Cancel signing request?"}
        </h2>
        <p id={`${dialogId}-description`}>
          {isDeclineConfirmation
            ? "This closes the signing request for every named signer. FSS must prepare a new revision to continue."
            : "This closes the signing request for every named signer. Existing evidence remains retained."}
        </p>
        <div className={styles.signingConfirmActions}>
          <PortalButton
            onClick={() => dialogRef.current?.close()}
            type="button"
            variant="secondary"
          >
            Keep request
          </PortalButton>
          <PortalButton
            onClick={() => {
              const action = confirmAction;
              dialogRef.current?.close();
              if (action) void execute(action, new FormData());
            }}
            type="button"
            variant="destructive"
          >
            {isDeclineConfirmation ? "Confirm decline" : "Confirm cancellation"}
          </PortalButton>
        </div>
      </dialog>
    </>
  );
}
