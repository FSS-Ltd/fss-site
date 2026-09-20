import Image from "next/image";
import styles from "./login-presentation.module.css";

export type PortalLoginPresentationProps = Readonly<{
  children: React.ReactNode;
  invitationMessage?: string;
  supportHref?: string;
  supportLabel?: string;
}>;

export function PortalLoginPresentation({
  children,
  invitationMessage,
  supportHref = "/contact",
  supportLabel = "Request access help",
}: PortalLoginPresentationProps): React.JSX.Element {
  return (
    <section className={styles.presentation} aria-labelledby="portal-login-heading">
      <header className={styles.introduction}>
        <Image
          alt="FSS"
          className={styles.brand}
          height={57}
          priority
          src="/redesign/brand/fss-monogram-navy-small.png"
          width={128}
        />
        <p className={styles.eyebrow}>Your FSS workspace</p>
        <h1 id="portal-login-heading">Sign in to FSS</h1>
        <p className={styles.lede}>
          One place for your project, feedback and next steps.
        </p>
      </header>

      <section className={styles.nextStep} aria-labelledby="portal-next-step-heading">
        <p className={styles.sectionLabel}>Your next step</p>
        <h2 id="portal-next-step-heading">Good work starts here.</h2>
        <p>
          Sign in with your invited email to see your workspace. Your project
          updates and decisions stay together.
        </p>
      </section>

      <section className={styles.signInCard} aria-labelledby="portal-sign-in-heading">
        <h2 id="portal-sign-in-heading">Sign in</h2>
        <div className={styles.formContent}>{children}</div>
      </section>

      {invitationMessage ? (
        <aside className={styles.invitation} aria-label="Invitation access">
          <p>Have an invitation?</p>
          <span>{invitationMessage}</span>
          <a href={supportHref}>{supportLabel}</a>
        </aside>
      ) : null}

      <p className={styles.footer}>
        Faithful Software Solutions · Built on trust. Delivered with care.
      </p>
    </section>
  );
}
