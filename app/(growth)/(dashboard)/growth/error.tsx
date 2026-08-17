"use client";

import { Button } from "@/components/ui/button";

import styles from "./route-state.module.css";

type GrowthDashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GrowthDashboardError({
  error,
  reset,
}: GrowthDashboardErrorProps) {
  return (
    <section aria-labelledby="growth-error-title" className={styles.errorState}>
      <p className={styles.eyebrow}>Dashboard unavailable</p>
      <h1 id="growth-error-title">This view could not be loaded</h1>
      <p>
        Try the request again. If it continues to fail, use the reference below
        when checking the server logs.
      </p>
      <p className={styles.correlation}>
        Reference: <code>{error.digest ?? "not available"}</code>
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
