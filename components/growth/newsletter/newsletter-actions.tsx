"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import type { NewsletterIssueReview } from "@/lib/growth/dashboard/newsletter";

import styles from "./newsletter.module.css";

type ActionKey = "send-test" | "approve-schedule";

type Feedback = { tone: "conflict" | "error" | "success"; message: string };

const NOT_TESTABLE_STATUSES = new Set(["sent", "failed", "cancelled"]);
const SCHEDULABLE_STATUSES = new Set(["ready_for_review", "approved"]);

async function postAction(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; message?: string }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    return { ok: false, status: response.status, message: payload?.message };
  } catch {
    return { ok: false, status: 0 };
  }
}

function formatLocal(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function NewsletterActionsFrame({
  issue,
  onSuccess,
}: {
  issue: NewsletterIssueReview;
  onSuccess: () => void;
}) {
  const formId = useId();
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mode, setMode] = useState<"idle" | "schedule-form" | "confirm-schedule">(
    "idle",
  );
  const [scheduledForLocal, setScheduledForLocal] = useState("");

  const busy = pendingAction !== null;
  const canTest = !NOT_TESTABLE_STATUSES.has(issue.status);
  const canSchedule = SCHEDULABLE_STATUSES.has(issue.status);
  const scheduledDate = scheduledForLocal ? new Date(scheduledForLocal) : null;
  const excludedCount = issue.audience.suppressedCount + issue.audience.pendingCount;

  async function run(action: ActionKey, path: string, body: Record<string, unknown>) {
    setPendingAction(action);
    setFeedback(null);
    const result = await postAction(path, body);
    setPendingAction(null);

    if (result.ok) {
      setMode("idle");
      if (action === "send-test") {
        setFeedback({ tone: "success", message: "Test email sent to the founder inbox." });
      }
      onSuccess();
      return;
    }
    if (result.status === 409) {
      setFeedback({
        tone: "conflict",
        message:
          result.message ??
          "This issue changed since you loaded it. Refresh to see the latest.",
      });
      return;
    }
    setFeedback({
      tone: "error",
      message: result.message ?? "The action could not be completed.",
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.readiness}>
        {issue.isLocked ? (
          <p className={styles.readinessReady}>
            This issue is approved and its content is locked.
          </p>
        ) : issue.isTestCurrent ? (
          <p className={styles.readinessReady}>
            Ready to approve and schedule once you are happy with the copy.
          </p>
        ) : (
          <p className={styles.readinessBlocked}>
            Send a founder test of this version before scheduling.
          </p>
        )}
      </div>

      <div aria-label="Newsletter decision" className={styles.actionsBar} role="group">
        {feedback && (
          <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
            {feedback.message}
          </p>
        )}

        <button
          className={styles.actionButton}
          disabled={busy || !canTest}
          onClick={() =>
            run("send-test", `/api/growth/newsletters/${issue.issueId}/send-test`, {})
          }
          type="button"
        >
          {pendingAction === "send-test" ? "Sending test…" : "Send test"}
        </button>

        <button
          className={styles.actionButton}
          data-variant="primary"
          disabled={busy || !canSchedule}
          onClick={() => setMode(mode === "idle" ? "schedule-form" : "idle")}
          type="button"
        >
          Approve &amp; schedule
        </button>
      </div>

      {mode === "schedule-form" && (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (scheduledDate) setMode("confirm-schedule");
          }}
        >
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${formId}-scheduled-for`}>
              Send at (your local time)
            </label>
            <input
              className={styles.textInput}
              id={`${formId}-scheduled-for`}
              onChange={(event) => setScheduledForLocal(event.target.value)}
              required
              type="datetime-local"
              value={scheduledForLocal}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.actionButton}
              data-variant="primary"
              disabled={!scheduledDate}
              type="submit"
            >
              Continue
            </button>
            <button
              className={styles.actionButton}
              onClick={() => setMode("idle")}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "confirm-schedule" && scheduledDate && (
        <div className={styles.dialogBackdrop} role="presentation">
          <div
            aria-labelledby={`${formId}-confirm-title`}
            className={styles.dialog}
            role="alertdialog"
          >
            <h2 className={styles.dialogTitle} id={`${formId}-confirm-title`}>
              Confirm and schedule
            </h2>
            <dl className={styles.dialogSummary}>
              <div>
                <strong>Local time:</strong> {formatLocal(scheduledDate)}
              </div>
              <div>
                <strong>UTC time:</strong> {formatUtc(scheduledDate)}
              </div>
              <div>
                <strong>Eligible recipients:</strong> {issue.audience.eligibleCount}
              </div>
              <div>
                <strong>Excluded:</strong> {excludedCount}
              </div>
              <div>
                <strong>Issue checksum:</strong> {issue.checksum.slice(0, 12)}…
              </div>
            </dl>
            <p>
              Consent is rechecked immediately before dispatch — anyone who
              unsubscribes before then will not receive this issue.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={styles.actionButton}
                onClick={() => setMode("schedule-form")}
                type="button"
              >
                Back
              </button>
              <button
                className={styles.actionButton}
                data-variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    "approve-schedule",
                    `/api/growth/newsletters/${issue.issueId}/approve-schedule`,
                    {
                      expectedVersion: issue.version,
                      scheduledFor: scheduledDate.toISOString(),
                    },
                  )
                }
                type="button"
              >
                {pendingAction === "approve-schedule"
                  ? "Scheduling…"
                  : "Approve & schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NewsletterActions({ issue }: { issue: NewsletterIssueReview }) {
  const router = useRouter();
  return (
    <NewsletterActionsFrame issue={issue} onSuccess={() => router.refresh()} />
  );
}
