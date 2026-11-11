"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AutomationSummary } from "@/lib/growth/dashboard/settings";

import styles from "./settings.module.css";

type Feedback = { tone: "error" | "success"; message: string };

async function postAction(
  path: string,
): Promise<{ ok: true; pausedSequenceCount: number } | { ok: false; message?: string }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; pausedSequenceCount?: number }
      | null;
    if (response.ok) {
      return { ok: true, pausedSequenceCount: payload?.pausedSequenceCount ?? 0 };
    }
    return { ok: false, message: payload?.message };
  } catch {
    return { ok: false };
  }
}

export function AutomationControlsFrame({
  automation,
  onSuccess,
}: {
  automation: AutomationSummary;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function pauseAll() {
    setBusy(true);
    setFeedback(null);
    const result = await postAction("/api/growth/settings/pause-automations");
    setBusy(false);

    if (result.ok) {
      setFeedback({
        tone: "success",
        message:
          result.pausedSequenceCount > 0
            ? `Paused ${result.pausedSequenceCount} active sequence${result.pausedSequenceCount === 1 ? "" : "s"}.`
            : "No active sequences needed pausing.",
      });
      onSuccess();
      return;
    }
    setFeedback({
      tone: "error",
      message: result.message ?? "The action could not be completed.",
    });
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Automation controls</h2>
      <ul className={styles.metaList}>
        <li className={styles.metaItem}>
          <span className={styles.metaLabel}>Active sequences</span>
          <span className={styles.metaValue}>{automation.activeSequenceCount}</span>
        </li>
      </ul>

      <div aria-label="Automation controls" className={styles.actionsBar} role="group">
        {feedback && (
          <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
            {feedback.message}
          </p>
        )}
        <button
          className={styles.actionButton}
          data-variant="danger"
          disabled={busy || automation.activeSequenceCount === 0}
          onClick={pauseAll}
          type="button"
        >
          {busy ? "Pausing…" : "Pause all active sequences"}
        </button>
      </div>

      <div className={styles.note}>
        <TriangleAlert aria-hidden="true" size={18} style={{ flex: "none" }} />
        <div>
          <strong>What this does and does not do</strong>
          <p>
            This pauses every currently active outreach sequence in the
            database — the same effect as pausing one from Outreach, applied
            to all of them at once. It does not disable the scheduled cron
            jobs below; those are controlled by the
            GROWTH_OS_AUTOMATIONS_ENABLED Vercel environment variable. To
            fully stop new automated work, an operator must also disable
            that flag in the Vercel project settings.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AutomationControls({ automation }: { automation: AutomationSummary }) {
  const router = useRouter();
  return (
    <AutomationControlsFrame
      automation={automation}
      onSuccess={() => router.refresh()}
    />
  );
}
