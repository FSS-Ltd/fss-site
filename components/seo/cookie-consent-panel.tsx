"use client";

import { useEffect, useRef } from "react";

import Link from "next/link";

import styles from "./cookie-consent.module.css";

type CookieConsentPanelProps = {
  focusOnMount?: boolean;
  onAccept: () => void;
  onDismiss?: () => void;
  onReject: () => void;
};

export function CookieConsentPanel({
  focusOnMount = false,
  onAccept,
  onDismiss,
  onReject,
}: CookieConsentPanelProps) {
  const rejectButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusOnMount) return;

    rejectButtonRef.current?.focus();

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss?.();
    };

    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [focusOnMount, onDismiss]);

  return (
    <aside
      aria-label="Analytics consent"
      aria-describedby="cookie-consent-description"
      aria-labelledby="cookie-consent-title"
      className={styles.panel}
    >
      <div className={styles.copy}>
        <p className={styles.eyebrow}>YOUR PRIVACY</p>
        <h2 className={styles.title} id="cookie-consent-title">
          Choose whether we use analytics
        </h2>
        <p className={styles.description} id="cookie-consent-description">
          We use essential storage to remember your choice. Google Analytics
          stays off unless you accept it. Read our{" "}
          <Link href="/privacy">privacy notice</Link>.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          onClick={onReject}
          ref={rejectButtonRef}
          type="button"
        >
          Reject analytics
        </button>
        <button
          className={styles.primaryButton}
          onClick={onAccept}
          type="button"
        >
          Accept analytics
        </button>
      </div>
    </aside>
  );
}
