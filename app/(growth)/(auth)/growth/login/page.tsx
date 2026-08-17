import type { Metadata } from "next";
import Image from "next/image";

import { continueWithGoogle } from "./actions";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Founder workspace",
  description: "Secure access to the FSS founder workspace.",
  robots: { index: false, follow: false },
};

function resolveErrorMessage(
  error: string | string[] | undefined,
): string | null {
  const errorCode = Array.isArray(error) ? error[0] : error;

  if (!errorCode) {
    return null;
  }

  if (errorCode === "AccessDenied") {
    return "This Google account is not authorised for the founder workspace.";
  }

  return "Sign-in could not be completed. Please try again.";
}

export default async function GrowthLoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = resolveErrorMessage(params.error);

  return (
    <section
      className={styles.loginViewport}
      aria-labelledby="growth-login-title"
    >
      <div className={styles.loginGlow} aria-hidden="true" />
      <div className={styles.loginCard}>
        <Image
          alt="Faithful Software Solutions"
          className={styles.loginMark}
          height={89}
          priority
          src="/redesign/brand/fss-monogram-navy.png"
          width={200}
        />

        <p className={styles.loginEyebrow}>Private access</p>
        <h1 className={styles.loginHeading} id="growth-login-title">
          Founder workspace
        </h1>
        <p className={styles.loginCopy}>
          Sign in with the authorised FSS Google Workspace account to continue.
        </p>

        {errorMessage ? (
          <p className={styles.loginNotice} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <form action={continueWithGoogle} className={styles.loginForm}>
          <button className={styles.loginAction} type="submit">
            Continue with Google
          </button>
        </form>

        <p className={styles.loginFootnote}>
          Access is restricted to the verified founder account.
        </p>
      </div>
    </section>
  );
}
