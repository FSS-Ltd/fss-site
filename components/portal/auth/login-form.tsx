"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, LockKeyhole, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./portal.module.css";

type Status =
  | { kind: "idle" | "pending" }
  | { kind: "success" | "error"; message: string };
export function PortalLoginForm({
  activation = false,
  linkError = false,
}: {
  activation?: boolean;
  linkError?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const token = useRef<string | null>(null);
  useEffect(() => {
    if (!activation) return;
    function captureInvitation(): void {
      if (!window.location.hash) return;
      const invites = new URLSearchParams(window.location.hash.slice(1)).getAll(
        "invite",
      );
      token.current =
        invites.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(invites[0])
          ? invites[0]
          : null;
      const pathname = window.location.pathname;
      window.history.replaceState(null, "", pathname);
      // Synchronize Next's canonical URL as well as the browser history.
      router.replace(pathname, { scroll: false });
    }
    captureInvitation();
    window.addEventListener("hashchange", captureInvitation);
    return () => window.removeEventListener("hashchange", captureInvitation);
  }, [activation, router]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (status.kind === "pending") return;
    if (activation && !token.current) {
      setStatus({
        kind: "error",
        message:
          "This invitation link is incomplete. Open the original link from your FSS team or ask for a replacement.",
      });
      return;
    }
    const email = new FormData(event.currentTarget).get("email");
    setStatus({ kind: "pending" });
    try {
      const response = await fetch("/portal/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(token.current ? { inviteToken: token.current } : {}),
        }),
      });
      if (response.ok)
        setStatus({
          kind: "success",
          message:
            "If this email has portal access, a sign-in link will arrive shortly. Open it in this browser to continue.",
        });
      else
        setStatus({
          kind: "error",
          message:
            response.status === 429
              ? "Too many attempts. Please try again in 15 minutes."
              : "We could not start sign in. Check your email address and try again.",
        });
    } catch {
      setStatus({
        kind: "error",
        message: "We could not connect. Check your connection and try again.",
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
      <p className={styles.eyebrow}>
        {activation ? "Your invitation" : "Your FSS workspace"}
      </p>
      <h1 id="portal-heading" className={styles.heading}>
        {activation ? "Welcome to your workspace." : "Welcome back."}
      </h1>
      <p className={styles.copy}>
        {activation
          ? "Use the email address your invitation was sent to. We’ll send a secure link to confirm it’s you."
          : "A secure link, sent to your email. Sign in to pick up where you left off."}
      </p>
      {linkError && (
        <p className={`${styles.feedback} ${styles.error}`} role="alert">
          This sign-in link could not be used. Request a fresh link below. If
          you are activating access, reopen your original invitation first.
        </p>
      )}
      <form
        onSubmit={submit}
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
          disabled={status.kind === "pending"}
        />
        <button
          type="submit"
          className={styles.button}
          disabled={status.kind === "pending"}
        >
          <span>
            {status.kind === "pending"
              ? "Sending link…"
              : "Continue with email"}
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
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
      </form>
      <p className={styles.reassurance}>
        <LockKeyhole size={14} aria-hidden="true" /> Private access. No password
        to remember.
      </p>
      {activation && (
        <p className={styles.actions}>
          <Link className={styles.link} href="/portal/login">
            Already have access? Sign in
          </Link>
        </p>
      )}
    </section>
  );
}
