"use client";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, LockKeyhole, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./portal.module.css";

type Phase = "email" | "code";
type Status = {
  kind: "idle" | "pending" | "success" | "error";
  message?: string;
};

export function PortalLoginForm(): React.JSX.Element {
  const router = useRouter();
  const {
    isLoaded: signInLoaded,
    setActive: setSignInActive,
    signIn,
  } = useSignIn();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [phase, setPhase] = useState<Phase>("email");
  const loaded = signInLoaded;

  async function claimAccess(): Promise<void> {
    const response = await fetch("/api/portal/access/claim", {
      method: "POST",
    });
    const result: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      typeof result !== "object" ||
      result === null ||
      !("active" in result) ||
      result.active !== true
    ) {
      throw new Error("Portal access is not active.");
    }
  }

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
      await claimAccess();
      setStatus({
        kind: "success",
        message: "Verified. Opening your workspace…",
      });
      router.replace("/portal");
    } catch {
      setStatus({
        kind: "error",
        message:
          "That code could not be verified. Request a new code and try again.",
      });
    }
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
      <p className={styles.eyebrow}>Your FSS workspace</p>
      <h1 id="portal-heading" className={styles.heading}>
        Welcome back.
      </h1>
      <p className={styles.copy}>
        We’ll send a one-time code to your email so you can continue securely.
      </p>
      {phase === "email" ? (
        <form
          onSubmit={submitEmail}
          className={styles.form}
          aria-busy={status.kind === "pending"}
        >
          <label htmlFor="portal-email" className={styles.label}>
            Email address
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
            className={styles.button}
            disabled={!loaded || status.kind === "pending"}
          >
            <span>
              {status.kind === "pending"
                ? "Sending code…"
                : "Continue with email"}
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
          <label htmlFor="portal-code" className={styles.label}>
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
            className={styles.button}
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
      <p className={styles.reassurance}>
        <LockKeyhole size={14} aria-hidden="true" /> Private access through your
        verified email.
      </p>
    </section>
  );
}
