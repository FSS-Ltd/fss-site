"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignUp } from "@clerk/nextjs";
import styles from "./portal.module.css";
import { claimPortalAccess } from "./portal-claim-request";

type Status = {
  kind: "idle" | "pending" | "error";
  message?: string;
};

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, ...(rest.length ? { lastName: rest.join(" ") } : {}) };
}

function getClerkErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("errors" in error)) return null;
  const errors = error.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0];
  return typeof first === "object" &&
    first !== null &&
    "message" in first &&
    typeof first.message === "string"
    ? first.message
    : null;
}

function isExistingSessionError(error: unknown): boolean {
  const message = getClerkErrorMessage(error) ?? (error instanceof Error ? error.message : "");
  return /session already exists/i.test(message);
}

export function PortalInvitationActivation(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialValues = useRef({
    ticket: searchParams.get("__clerk_ticket"),
    name: searchParams.get("name") ?? "",
    email: searchParams.get("email") ?? "",
  });
  const { signUp, fetchStatus } = useSignUp();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const ticket = initialValues.current.ticket;
  const busy = status.kind === "pending" || fetchStatus === "fetching";

  useEffect(() => {
    if (initialValues.current.name || initialValues.current.email)
      window.history.replaceState({}, "", "/portal/activate");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!ticket || busy) return;
    const form = new FormData(event.currentTarget);
    const name = form.get("name")?.toString().trim();
    const password = form.get("password")?.toString();
    const confirmation = form.get("confirmation")?.toString();
    if (!name || !password || password !== confirmation) {
      setStatus({
        kind: "error",
        message:
          password !== confirmation
            ? "Your passwords do not match."
            : "Complete every field.",
      });
      return;
    }
    setStatus({ kind: "pending" });
    try {
      const { firstName, lastName } = splitName(name);
      const ticketResult = await signUp.ticket({ ticket, firstName, lastName });
      if (ticketResult.error) {
        throw new Error(
          getClerkErrorMessage(ticketResult.error) ??
            "This invitation is no longer available.",
        );
      }
      if (signUp.status !== "complete") {
        const passwordResult = await signUp.password({ password });
        if (passwordResult.error)
          throw new Error(
            getClerkErrorMessage(passwordResult.error) ??
              "Your password could not be set. Check the requirements and try again.",
          );
      }
      if (signUp.status !== "complete")
        throw new Error(
          "Your account needs more information before it can be created.",
        );
      const finalResult = await signUp.finalize();
      if (finalResult.error)
        throw new Error(
          getClerkErrorMessage(finalResult.error) ??
            "Your account could not be activated.",
        );
      router.replace(await claimPortalAccess(name));
    } catch (error) {
      if (isExistingSessionError(error)) {
        try {
          const destination = await claimPortalAccess(name ?? "");
          setStatus({ kind: "pending" });
          router.replace(destination);
          return;
        } catch {
          // Fall through to the safe invitation error below.
        }
      }
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your invitation could not be accepted. Ask FSS for a new invitation.",
      });
    }
  }

  if (!ticket) {
    return (
      <section className={styles.authPanel} aria-labelledby="portal-heading">
        <p className={styles.eyebrow}>Invitation required</p>
        <h1 id="portal-heading" className={styles.heading}>
          This invitation link is incomplete.
        </h1>
        <p className={styles.copy}>
          Open the invitation email from FSS, or ask your FSS contact for a new
          invitation.
        </p>
        <p className={styles.actions}>
          <Link className={styles.link} href="/portal/login">
            Go to portal sign in
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className={styles.authPanel} aria-labelledby="portal-heading">
      <div className={styles.identityMark} aria-hidden="true">
        <Image
          src="/redesign/brand/fss-monogram-navy-small.png"
          alt=""
          width={74}
          height={32}
          style={{ height: "auto" }}
          priority
        />
      </div>
      <p className={styles.eyebrow}>Your FSS invitation</p>
      <h1 id="portal-heading" className={styles.heading}>
        Create your account.
      </h1>
      <p className={styles.copy}>
        Your invitation has securely verified your email address. Confirm your
        name and choose a password to activate your workspace access.
      </p>
      <form onSubmit={submit} className={styles.form} aria-busy={busy}>
        {initialValues.current.email && (
          <>
            <label htmlFor="portal-invitation-email" className={styles.label}>
              Email address
            </label>
            <input
              className={styles.input}
              id="portal-invitation-email"
              readOnly
              type="email"
              value={initialValues.current.email}
            />
          </>
        )}
        <label htmlFor="portal-invitation-name" className={styles.label}>
          Full name
        </label>
        <input
          autoComplete="name"
          autoFocus
          className={styles.input}
          defaultValue={initialValues.current.name}
          id="portal-invitation-name"
          maxLength={200}
          name="name"
          required
          disabled={busy}
        />
        <label htmlFor="portal-invitation-password" className={styles.label}>
          Create a password
        </label>
        <input
          autoComplete="new-password"
          className={styles.input}
          id="portal-invitation-password"
          minLength={8}
          name="password"
          required
          type="password"
          disabled={busy}
        />
        <label
          htmlFor="portal-invitation-confirmation"
          className={styles.label}
        >
          Confirm password
        </label>
        <input
          autoComplete="new-password"
          className={styles.input}
          id="portal-invitation-confirmation"
          minLength={8}
          name="confirmation"
          required
          type="password"
          disabled={busy}
        />
        <button type="submit" className={styles.button} disabled={busy}>
          <span>
            {busy ? "Creating account…" : "Create account and continue"}
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <div id="clerk-captcha" />
      </form>
      <div aria-live="polite" aria-atomic="true">
        {status.kind === "error" && (
          <p className={`${styles.feedback} ${styles.error}`}>
            {status.message}
          </p>
        )}
      </div>
      <p className={styles.reassurance}>
        <LockKeyhole size={14} aria-hidden="true" /> Your role is set by FSS
        when this invitation is accepted.
      </p>
      <p className={styles.actions}>
        <Link className={styles.link} href="/portal/login">
          Already have access? Sign in
        </Link>
      </p>
    </section>
  );
}
