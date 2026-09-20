"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSignUp, useUser } from "@clerk/nextjs";
import styles from "./portal.module.css";
import {
  completeInvitationSignUp,
  invitationAddressWithoutPersonalDetails,
} from "./invitation-sign-up";
import { claimPortalAccess } from "./portal-claim-request";
import {
  defaultPortalClaimDestinations,
  type PortalClaimDestinations,
} from "./portal-claim-destination";

type Status = {
  kind: "idle" | "pending" | "error";
  message?: string;
};

export function PortalInvitationActivation({
  activationPath = "/activate",
  claimDestinations = defaultPortalClaimDestinations,
  loginPath = "/login",
}: {
  activationPath?: string;
  claimDestinations?: PortalClaimDestinations;
  loginPath?: string;
}): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialValues] = useState(() => ({
    ticket: searchParams.get("__clerk_ticket"),
    name: searchParams.get("name") ?? "",
    email: searchParams.get("email") ?? "",
  }));
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded, isSignedIn, user } = useUser();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const ticket = initialValues.ticket;
  const busy =
    !isLoaded || status.kind === "pending" || fetchStatus === "fetching";

  useEffect(() => {
    if (initialValues.name || initialValues.email)
      window.history.replaceState(
        {},
        "",
        invitationAddressWithoutPersonalDetails(
          activationPath,
          window.location.search,
        ),
      );
  }, [activationPath, initialValues.name, initialValues.email]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!ticket || busy) return;
    const form = new FormData(event.currentTarget);
    const name = form.get("name")?.toString().trim();
    const password = form.get("password")?.toString();
    const confirmation = form.get("confirmation")?.toString();
    if (isSignedIn) {
      const invitedEmail = initialValues.email.trim().toLowerCase();
      if (
        invitedEmail &&
        invitedEmail !== user.primaryEmailAddress?.emailAddress.toLowerCase()
      ) {
        setStatus({
          kind: "error",
          message:
            "This invitation is for another email address. Sign out and open the invitation again with the invited account.",
        });
        return;
      }
      setStatus({ kind: "pending" });
      try {
        router.replace(
          await claimPortalAccess(undefined, {
            destinations: claimDestinations,
          }),
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
      return;
    }
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
      await completeInvitationSignUp({
        signUp,
        ticket,
        name,
        password,
        claim: (displayName) =>
          claimPortalAccess(displayName, { destinations: claimDestinations }),
        navigate: (url) => {
          if (url.startsWith("http")) window.location.assign(url);
          else router.replace(url);
        },
      });
    } catch (error) {
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
          <Link className={styles.link} href={loginPath}>
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
        {isSignedIn ? "Accept your invitation." : "Create your account."}
      </h1>
      <p className={styles.copy}>
        {isSignedIn
          ? `Continue as ${user.primaryEmailAddress?.emailAddress ?? "the signed-in user"} to activate your approved access.`
          : "Confirm your name and choose a password to activate your workspace access."}
      </p>
      <form onSubmit={submit} className={styles.form} aria-busy={busy}>
        {initialValues.email && (
          <>
            <label htmlFor="portal-invitation-email" className={styles.label}>
              Email address
            </label>
            <input
              className={styles.input}
              id="portal-invitation-email"
              readOnly
              type="email"
              value={initialValues.email}
            />
          </>
        )}
        {!isSignedIn && (
          <>
            <label htmlFor="portal-invitation-name" className={styles.label}>
              Full name
            </label>
            <input
              autoComplete="name"
              autoFocus
              className={styles.input}
              defaultValue={initialValues.name}
              id="portal-invitation-name"
              maxLength={200}
              name="name"
              required
              disabled={busy}
            />
            <label
              htmlFor="portal-invitation-password"
              className={styles.label}
            >
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
          </>
        )}
        <button type="submit" className={styles.button} disabled={busy}>
          <span>
            {busy
              ? "Opening your workspace…"
              : isSignedIn
                ? "Accept invitation and continue"
                : "Create account and continue"}
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
      {isSignedIn && (
        <form
          method="post"
          action="/api/auth/sign-out"
          className={styles.actions}
        >
          <button type="submit" className={styles.textButton}>
            Sign out and use another account
          </button>
        </form>
      )}
      <p className={styles.actions}>
        <Link className={styles.link} href={loginPath}>
          Already have access? Sign in
        </Link>
      </p>
    </section>
  );
}
