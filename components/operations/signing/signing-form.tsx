"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  SIGNING_CONSENT,
  type SigningApproval,
} from "@/lib/operations/agreements/signing-types";
import styles from "../agreements/agreements.module.css";

export function SigningForm({
  organisationId,
  approval,
  audience,
  agreement,
}: {
  organisationId: string;
  approval?: SigningApproval;
  audience: "founder" | "portal";
  agreement?: { id: string; version: number };
}): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action =
      submitter instanceof HTMLButtonElement ? submitter.value : "";
    if (!action || pending) return;
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
      const prefix =
        audience === "founder"
          ? "/api/growth/operations/clients"
          : "/api/portal/organisations";
      const response = await fetch(`${prefix}/${organisationId}/signing`, {
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
          : "Agreement updated.",
      );
      if (action === "prepare")
        router.push(`/growth/operations/clients/${organisationId}/signing`);
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
  return (
    <form onSubmit={submit} className={styles.form}>
      {agreement ? (
        <>
          <p>
            Prepare a frozen PDF from this revision, then review it before
            opening it for signing.
          </p>
          <button
            className={styles.primary}
            type="submit"
            value="prepare"
            disabled={pending}
          >
            Prepare signing document
          </button>
        </>
      ) : audience === "founder" ? (
        <>
          {approval?.status === "prepared" && (
            <>
              <label className={styles.field}>
                Signing deadline (UTC)
                <input
                  name="expiresAt"
                  type="date"
                  required
                  disabled={pending}
                />
              </label>
              <p>Choose a future deadline within the next 90 days.</p>
              <label>
                <input type="checkbox" required disabled={pending} />I have
                reviewed this exact document and its required signers. I approve
                it for electronic signing as an ordinary service agreement.
              </label>
              <button
                className={styles.primary}
                type="submit"
                value="approve"
                disabled={pending}
              >
                Approve and open for signing
              </button>
            </>
          )}
          {(approval?.status === "prepared" ||
            (approval?.status === "approved" &&
              approval.signatures.length <
                approval.requiredSigners.length)) && (
            <button
              type="submit"
              value="cancel"
              formNoValidate
              disabled={pending}
            >
              Cancel signing
            </button>
          )}
        </>
      ) : (
        <>
          <label className={styles.field}>
            Your full name
            <input
              name="typedName"
              autoComplete="name"
              minLength={2}
              maxLength={200}
              required
              disabled={pending || Boolean(success)}
            />
          </label>
          <label>
            <input
              name="authority"
              type="checkbox"
              required
              disabled={pending || Boolean(success)}
            />
            I have authority to bind the named organisation.
          </label>
          <label>
            <input
              name="consent"
              type="checkbox"
              required
              disabled={pending || Boolean(success)}
            />
            {SIGNING_CONSENT}
          </label>
          <button
            className={styles.primary}
            type="submit"
            value="sign"
            disabled={pending || Boolean(success)}
          >
            {pending ? "Saving…" : "Sign agreement"}
          </button>
          <details>
            <summary>Unable to accept this agreement?</summary>
            <p>
              Declining closes this signing request for everyone. Contact your
              FSS team to discuss revised terms.
            </p>
            <button
              type="submit"
              value="decline"
              formNoValidate
              disabled={pending || Boolean(success)}
            >
              Decline agreement
            </button>
          </details>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
    </form>
  );
}
