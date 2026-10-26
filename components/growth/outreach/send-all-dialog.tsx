"use client";

import { useEffect, useRef, useState } from "react";
import type { OutreachDraftRow } from "@/lib/growth/dashboard/outreach-drafts";
import { BatchDraftCard } from "./batch-draft-card";
import {
  canSendBatchDraft,
  loadBatchDraft,
  sendBatchDraft,
  type BatchDraftEntry,
} from "./batch-draft-review";
import { OutreachDialog } from "./outreach-dialog";
import styles from "./outreach.module.css";
import dialogStyles from "./outreach-dialog.module.css";

export function SendAllDialog({
  rows,
  onClose,
}: {
  rows: readonly OutreachDraftRow[];
  onClose: (attempted: boolean) => void;
}): React.JSX.Element {
  const [entries, setEntries] = useState<BatchDraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [phase, setPhase] = useState<"review" | "sending" | "complete">(
    "review",
  );
  const [processed, setProcessed] = useState(0);
  const sending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load(): Promise<void> {
      const loaded: BatchDraftEntry[] = [];
      for (const row of rows) {
        if (controller.signal.aborted) return;
        const entry: BatchDraftEntry = {
          ...row,
          message: null,
          permission: { basis: "", evidence: "" },
          result: null,
          error: null,
        };
        try {
          entry.message = await loadBatchDraft(
            row.draftTaskId,
            controller.signal,
          );
        } catch {
          if (controller.signal.aborted) return;
          entry.error =
            "This draft could not load. Open its review before sending.";
        }
        loaded.push(entry);
      }
      if (!controller.signal.aborted) {
        setEntries(loaded);
        setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [rows]);

  const ready = entries.filter(canSendBatchDraft);
  const valid =
    ready.length > 0 &&
    ready.every(
      (entry) =>
        !entry.message?.researchOnly ||
        (entry.permission.basis &&
          entry.permission.evidence.trim().length >= 10),
    );
  const locked = phase !== "review";

  async function send(): Promise<void> {
    if (sending.current || loading || !reviewed || !valid) return;
    sending.current = true;
    setPhase("sending");
    for (const entry of ready) {
      let updated: BatchDraftEntry;
      try {
        updated = {
          ...entry,
          result: await sendBatchDraft(entry),
          error: null,
        };
      } catch (failure) {
        updated = {
          ...entry,
          error:
            failure instanceof Error
              ? failure.message
              : "Delivery was not confirmed. Open the review before retrying.",
        };
      }
      setEntries((current) =>
        current.map((row) =>
          row.draftTaskId === entry.draftTaskId ? updated : row,
        ),
      );
      setProcessed((count) => count + 1);
    }
    setPhase("complete");
  }

  return (
    <OutreachDialog
      title="Review and send all"
      description={`Review the ${rows.length} displayed drafts before confirming. Blocked drafts will be skipped.`}
      wide
      busy={phase === "sending"}
      onClose={() => onClose(locked)}
    >
      <form
        className={dialogStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        aria-label="Confirm all outreach drafts"
      >
        <p role="status" aria-live="polite">
          {loading
            ? "Loading current drafts…"
            : phase === "complete"
              ? `Batch complete. ${processed} processed. Check each delivery result below.`
              : phase === "sending"
                ? `Sending ${processed} of ${ready.length}. Keep this window open.`
                : `${ready.length} ready · ${entries.length - ready.length} skipped`}
        </p>
        <ul className={dialogStyles.list}>
          {entries.map((entry) => (
            <BatchDraftCard
              key={entry.draftTaskId}
              entry={entry}
              locked={locked}
              onPermissionChange={(permission) =>
                setEntries((current) =>
                  current.map((row) =>
                    row.draftTaskId === entry.draftTaskId
                      ? { ...row, permission }
                      : row,
                  ),
                )
              }
            />
          ))}
        </ul>
        {!locked && !loading && (
          <label className={dialogStyles.check}>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I have reviewed every ready email and verified permission for each
            recipient.
          </label>
        )}
        <div className={dialogStyles.actions}>
          <button
            className={styles.actionButton}
            type="button"
            disabled={phase === "sending"}
            onClick={() => onClose(locked)}
          >
            {phase === "complete" ? "Close" : "Cancel"}
          </button>
          {!locked && !loading && (
            <button
              className={styles.actionButton}
              data-variant="primary"
              type="submit"
              disabled={!reviewed || !valid}
            >
              Confirm &amp; send {ready.length}{" "}
              {ready.length === 1 ? "email" : "emails"}
            </button>
          )}
        </div>
      </form>
    </OutreachDialog>
  );
}
