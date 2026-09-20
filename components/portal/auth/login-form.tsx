"use client";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useUser } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./login-presentation.module.css";
import { PortalLoginPresentation } from "./login-presentation";
import { claimPortalAccess } from "./portal-claim-request";
import { PortalSignOutButton } from "./portal-sign-out";
import {
  defaultPortalClaimDestinations,
  type PortalClaimDestinations,
} from "./portal-claim-destination";

type Phase = "email" | "code";
type Status = {
  kind: "idle" | "pending" | "success" | "error";
  message?: string;
};

export function PortalLoginForm({
  claimDestinations = defaultPortalClaimDestinations,
  supportHref,
}: {
  claimDestinations?: PortalClaimDestinations;
  supportHref?: string;
}): React.JSX.Element {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const {
    isLoaded: signInLoaded,
    setActive: setSignInActive,
    signIn,
  } = useSignIn();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [phase, setPhase] = useState<Phase>("email");
  const loaded = signInLoaded;

  async function submitEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!loaded || status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      const submittedEmail = new FormData(event.currentTarget)
        .get("email")
        ?.toString()
        .trim()
        .toLowerCase();
      if (!submittedEmail) throw new Error("Enter a valid email address.");
      if (!signIn) throw new Error("Sign-in is unavailable.");
      const result = await signIn.create({ identifier: submittedEmail });
      const factor = result.supportedFirstFactors?.find(
        (candidate) => candidate.strategy === "email_code",
      );
      if (!factor || factor.strategy !== "email_code")
        throw new Error("Email code sign-in is unavailable.");
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setPhase("code");
      setStatus({ kind: "idle" });
    } catch {
      setStatus({
        kind: "error",
        message:
          "We could not start sign in. Check your email address and try again.",
      });
    }
  }

  async function continueSession(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      router.replace(
        await claimPortalAccess(undefined, { destinations: claimDestinations }),
      );
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Access could not be activated.",
      });
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!loaded || status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      const code = new FormData(event.currentTarget)
        .get("code")
        ?.toString()
        .trim();
      if (!code) throw new Error("Enter the code.");
      const portalSignIn = signIn;
      const activateSignIn = setSignInActive;
      if (!portalSignIn || !activateSignIn)
        throw new Error("Sign-in is unavailable.");
      const result = await portalSignIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      });
      if (result.status !== "complete" || !result.createdSessionId)
        throw new Error("Verification is incomplete.");
      await activateSignIn({ session: result.createdSessionId });
      const destination = await claimPortalAccess(undefined, {
        destinations: claimDestinations,
      });
      setStatus({
        kind: "success",
        message: "Verified. Opening your workspace…",
      });
      router.replace(destination);
    } catch {
      setStatus({
        kind: "error",
        message:
          "That code could not be verified. Request a new code and try again.",
      });
    }
  }

  return (
    <PortalLoginPresentation
      invitationMessage="Open the invitation link from your email to activate approved access."
      supportHref={supportHref}
    >
      {isSignedIn ? (
        <form
          onSubmit={continueSession}
          className={styles.form}
          aria-busy={status.kind === "pending"}
        >
          <button
            className={styles.submit}
            disabled={status.kind === "pending"}
            type="submit"
          >
            {status.kind === "pending"
              ? "Opening your workspace…"
              : "Continue to your workspace"}
          </button>
        </form>
      ) : phase === "email" ? (
        <form
          onSubmit={submitEmail}
          className={styles.form}
          aria-busy={status.kind === "pending"}
        >
          <label htmlFor="portal-email" className={styles.fieldLabel}>
            Work email
          </label>
          <input
            id="portal-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            maxLength={254}
            required
            className={styles.input}
            disabled={!loaded || status.kind === "pending"}
          />
          <button
            type="submit"
            className={styles.submit}
            disabled={!loaded || status.kind === "pending"}
          >
            <span>
              {status.kind === "pending"
                ? "Sending code…"
                : "Continue"}
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <form
          onSubmit={submitCode}
          className={styles.form}
          aria-busy={status.kind === "pending"}
        >
          <label htmlFor="portal-code" className={styles.fieldLabel}>
            Verification code
          </label>
          <input
            id="portal-code"
            name="code"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="Enter the code from your email"
            required
            className={styles.input}
            disabled={!loaded || status.kind === "pending"}
          />
          <button
            type="submit"
            className={styles.submit}
            disabled={!loaded || status.kind === "pending"}
          >
            <span>
              {status.kind === "pending" ? "Verifying…" : "Verify and continue"}
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button
            className={styles.textButton}
            onClick={() => setPhase("email")}
            type="button"
          >
            Use a different email
          </button>
        </form>
      )}
      <div aria-live="polite" aria-atomic="true">
        {(status.kind === "success" || status.kind === "error") && (
          <p
            className={`${styles.feedback} ${status.kind === "error" ? styles.error : ""}`}
          >
            {status.kind === "success" && (
              <MailCheck
                size={22}
                aria-hidden="true"
                className={styles.feedbackIcon}
              />
            )}
            {status.message}
          </p>
        )}
      </div>
      {isSignedIn && (
        <p className={styles.actions}>
          <PortalSignOutButton className={styles.textButton}>
            Sign out and use another account
          </PortalSignOutButton>
        </p>
      )}
      <p className={styles.reassurance}>
        Private access through your verified email.
      </p>
    </PortalLoginPresentation>
  );
}
