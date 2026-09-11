import type { Metadata } from "next";
import Image from "next/image";
import { FounderLoginForm } from "@/components/growth/auth/founder-login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Founder workspace",
  description: "Secure access to the FSS founder workspace.",
  robots: { index: false, follow: false },
};

export default function GrowthLoginPage() {
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
          Enter the authorised founder email. We will send a verification code.
        </p>
        <FounderLoginForm />

        <p className={styles.loginFootnote}>
          Access is restricted to the verified founder account.
        </p>
      </div>
    </section>
  );
}
