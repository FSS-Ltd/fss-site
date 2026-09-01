"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SeoAuditReviewData } from "@/lib/growth/dashboard/seo-audits";

import styles from "./outreach.module.css";

type Feedback = { tone: "conflict" | "error" | "success"; message: string };

export function SeoAuditActions({ data }: { data: SeoAuditReviewData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function approve(): Promise<void> {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/growth/seo-audits/${data.auditId}/approve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion: data.version }),
        },
      );
      if (response.ok) {
        setFeedback({
          tone: "success",
          message:
            "Approved. This individual audit email is now queued for the Day 11 send window.",
        });
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setFeedback({
        tone: response.status === 409 ? "conflict" : "error",
        message:
          payload?.message ??
          "The audit email could not be approved. Reload to see the latest state.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "The audit email could not be approved.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>Founder decision</h2>
      <div
        aria-label="SEO audit email decision"
        className={styles.actionsBar}
        role="group"
      >
        {feedback && (
          <p
            className={styles.actionFeedback}
            data-tone={feedback.tone}
            role="alert"
          >
            {feedback.message}
          </p>
        )}
        {data.eligibility.ready ? (
          <p className={styles.readinessReady}>Ready for founder approval.</p>
        ) : (
          <>
            <p className={styles.readinessBlocked}>
              Approval is blocked until these are resolved:
            </p>
            <ul className={styles.readinessReasons}>
              {data.eligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        <button
          className={styles.actionButton}
          data-variant="primary"
          disabled={pending || !data.eligibility.ready}
          onClick={approve}
          type="button"
        >
          {pending ? "Approving…" : "Approve for Day 11 queue"}
        </button>
        <p className={styles.actionHelp}>
          Approval queues this specific PDF and email draft. It does not change
          the shared follow-up template.
        </p>
      </div>
    </section>
  );
}
