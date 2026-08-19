"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ProspectDetail } from "@/lib/growth/dashboard/prospect-detail";
import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";

import styles from "./prospects.module.css";

const TERMINAL_PROSPECT_STATUSES = new Set([
  "won",
  "lost",
  "rejected",
  "suppressed",
]);

const TERMINAL_SEQUENCE_STATUSES = new Set([
  "stopped_reply",
  "stopped_opt_out",
  "stopped_bounce",
  "stopped_rejected",
  "stopped_started_talks",
  "completed",
]);

const STALE_RESEARCH_DAYS = 30;

export type ApprovalReadiness = {
  ready: boolean;
  reasons: readonly string[];
};

export function evaluateApprovalReadiness(
  prospect: ProspectDetail,
  integrations: readonly IntegrationHealth[],
  now: string,
): ApprovalReadiness {
  const reasons: string[] = [];

  if (prospect.status === "suppressed") {
    reasons.push("This prospect is suppressed and cannot be contacted.");
  }
  if (prospect.business.corporateStatus === "uncertain") {
    reasons.push("The company's corporate status is unverified.");
  }
  if (!prospect.contact) {
    reasons.push("No verified contact is on file for this prospect.");
  }

  const businessAgeMs =
    new Date(now).getTime() - new Date(prospect.business.verifiedAt).getTime();
  if (businessAgeMs > STALE_RESEARCH_DAYS * 24 * 60 * 60 * 1000) {
    reasons.push("Research is more than 30 days old and should be refreshed.");
  }

  if (
    !prospect.visualAsset ||
    prospect.visualAsset.reviewStatus === "rejected" ||
    prospect.visualAsset.reviewStatus === "fallback"
  ) {
    reasons.push("The generated visual has not passed validation.");
  }

  const gmail = integrations.find((integration) => integration.provider === "gmail");
  if (gmail && gmail.status !== "healthy") {
    reasons.push("Gmail is disconnected. Reconnect it in Settings to send.");
  }

  return { ready: reasons.length === 0, reasons };
}

type ActionKey =
  | "request-research"
  | "reject"
  | "do-not-contact"
  | "started-talks"
  | "pause";

const ACTION_LABELS: Record<ActionKey, string> = {
  "request-research": "Re-research",
  reject: "Reject",
  "do-not-contact": "Do not contact",
  "started-talks": "Started talks",
  pause: "Pause",
};

const ACTION_PENDING_LABELS: Record<ActionKey, string> = {
  "request-research": "Requesting…",
  reject: "Rejecting…",
  "do-not-contact": "Suppressing…",
  "started-talks": "Saving…",
  pause: "Pausing…",
};

export function ProspectActionsFrame({
  integrations,
  now,
  onSuccess,
  prospect,
}: {
  integrations: readonly IntegrationHealth[];
  now: string;
  onSuccess: () => void;
  prospect: ProspectDetail;
}) {
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "conflict" | "error";
    message: string;
  } | null>(null);

  const isTerminal = TERMINAL_PROSPECT_STATUSES.has(prospect.status);
  const canPause =
    prospect.sequence !== null &&
    !TERMINAL_SEQUENCE_STATUSES.has(prospect.sequence.status);
  const readiness = evaluateApprovalReadiness(prospect, integrations, now);

  async function runAction(action: ActionKey, path: string) {
    setPendingAction(action);
    setFeedback(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: prospect.version }),
      });

      if (response.ok) {
        onSuccess();
        return;
      }

      if (response.status === 409) {
        setFeedback({
          tone: "conflict",
          message:
            "This prospect changed since you loaded it. Refresh to see the latest.",
        });
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setFeedback({
        tone: "error",
        message: body?.message ?? "The action could not be completed.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "The action could not be completed. Check your connection and try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  const busy = pendingAction !== null;

  return (
    <div>
      <div aria-label="Prospect actions" className={styles.actionsBar} role="group">
        {feedback && (
          <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
            {feedback.message}
          </p>
        )}

        <button
          className={styles.actionButton}
          disabled={isTerminal || busy}
          onClick={() =>
            runAction(
              "request-research",
              `/api/growth/prospects/${prospect.id}/request-research`,
            )
          }
          type="button"
        >
          {pendingAction === "request-research"
            ? ACTION_PENDING_LABELS["request-research"]
            : ACTION_LABELS["request-research"]}
        </button>

        <button
          className={styles.actionButton}
          disabled={isTerminal || busy}
          onClick={() =>
            runAction("reject", `/api/growth/prospects/${prospect.id}/reject`)
          }
          type="button"
        >
          {pendingAction === "reject"
            ? ACTION_PENDING_LABELS.reject
            : ACTION_LABELS.reject}
        </button>

        <button
          className={styles.actionButton}
          disabled={isTerminal || busy}
          onClick={() =>
            runAction(
              "do-not-contact",
              `/api/growth/prospects/${prospect.id}/do-not-contact`,
            )
          }
          type="button"
        >
          {pendingAction === "do-not-contact"
            ? ACTION_PENDING_LABELS["do-not-contact"]
            : ACTION_LABELS["do-not-contact"]}
        </button>

        <button
          className={styles.actionButton}
          disabled={isTerminal || busy}
          onClick={() =>
            runAction(
              "started-talks",
              `/api/growth/prospects/${prospect.id}/started-talks`,
            )
          }
          type="button"
        >
          {pendingAction === "started-talks"
            ? ACTION_PENDING_LABELS["started-talks"]
            : ACTION_LABELS["started-talks"]}
        </button>

        <button
          className={styles.actionButton}
          disabled={!canPause || busy}
          onClick={() =>
            runAction("pause", `/api/growth/sequences/${prospect.sequence?.id}/pause`)
          }
          type="button"
        >
          {pendingAction === "pause"
            ? ACTION_PENDING_LABELS.pause
            : ACTION_LABELS.pause}
        </button>

        {!canPause && (
          <p className={styles.actionNote}>
            {prospect.sequence
              ? "This sequence has already stopped."
              : "No active sequence to pause yet."}
          </p>
        )}
      </div>

      <div className={styles.readiness}>
        {readiness.ready ? (
          <p className={styles.readinessReady}>Ready for founder review.</p>
        ) : (
          <>
            <p className={styles.readinessBlocked}>
              Approval is blocked until these are resolved:
            </p>
            <ul className={styles.readinessReasons}>
              {readiness.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function ProspectActions(props: {
  integrations: readonly IntegrationHealth[];
  now: string;
  prospect: ProspectDetail;
}) {
  const router = useRouter();
  return (
    <ProspectActionsFrame {...props} onSuccess={() => router.refresh()} />
  );
}
