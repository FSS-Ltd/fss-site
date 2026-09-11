"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/(growth)/(auth)/growth/login/login.module.css";

type Phase = "email" | "code";

export function FounderLoginForm(): React.JSX.Element {
  const router = useRouter();
  const { isLoaded, setActive, signIn } = useSignIn();
  const [phase, setPhase] = useState<Phase>("email");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isLoaded || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const email = new FormData(event.currentTarget).get("email")?.toString().trim();
      if (!email) throw new Error("Missing email.");
      const result = await signIn.create({ identifier: email });
      const factor = result.supportedFirstFactors?.find(
        (candidate) => candidate.strategy === "email_code",
      );
      if (!factor || factor.strategy !== "email_code")
        throw new Error("Email codes are unavailable.");
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setPhase("code");
    } catch {
      setMessage("We could not start sign-in. Use the authorised founder email and try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isLoaded || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const code = new FormData(event.currentTarget).get("code")?.toString().trim();
      if (!code) throw new Error("Missing code.");
      const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
      if (result.status !== "complete" || !result.createdSessionId)
        throw new Error("Sign-in is incomplete.");
      await setActive({ session: result.createdSessionId });
      router.replace("/growth");
    } catch {
      setMessage("That code could not be verified. Request a new code and try again.");
    } finally {
      setPending(false);
    }
  }

  return phase === "email" ? (
    <form action="#" className={styles.loginForm} onSubmit={submitEmail}>
      <label className="sr-only" htmlFor="founder-email">Founder email</label>
      <input autoComplete="email" className={styles.loginInput} disabled={!isLoaded || pending} id="founder-email" inputMode="email" name="email" placeholder="you@faithfulsoftware.dev" required type="email" />
      <button className={styles.loginAction} disabled={!isLoaded || pending} type="submit">
        {pending ? "Sending code…" : "Continue with email"}
      </button>
      {message && <p className={styles.loginNotice} role="alert">{message}</p>}
    </form>
  ) : (
    <form action="#" className={styles.loginForm} onSubmit={submitCode}>
      <label className="sr-only" htmlFor="founder-code">Verification code</label>
      <input autoComplete="one-time-code" className={styles.loginInput} disabled={!isLoaded || pending} id="founder-code" inputMode="numeric" name="code" placeholder="Code from your email" required type="text" />
      <button className={styles.loginAction} disabled={!isLoaded || pending} type="submit">
        {pending ? "Verifying…" : "Verify and continue"}
      </button>
      <button className={styles.loginSecondaryAction} onClick={() => setPhase("email")} type="button">Use a different email</button>
      {message && <p className={styles.loginNotice} role="alert">{message}</p>}
    </form>
  );
}
