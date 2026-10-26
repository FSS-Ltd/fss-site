"use client";

import { useId, useState } from "react";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";
import { postResearchDraftAction } from "./research-draft-request";
import styles from "./outreach.module.css";

export function ResearchDraftEditor({
  message,
  onCancel,
  onSaved,
}: {
  message: MessageReviewData;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.previewText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={styles.inlineForm}
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          await postResearchDraftAction(
            `/api/growth/messages/${message.draftTaskId}/edit-draft`,
            {
              expectedVersion: message.version,
              subject,
              paragraphs: body
                .split(/\n{2,}/)
                .map((part) => part.trim())
                .filter(Boolean),
            },
          );
          onSaved();
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "The draft could not be saved.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-subject`}>
          Subject
        </label>
        <input
          className={styles.textInput}
          id={`${id}-subject`}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          maxLength={200}
          disabled={pending}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-body`}>
          Email copy
        </label>
        <textarea
          className={styles.textArea}
          id={`${id}-body`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={20000}
          rows={12}
          disabled={pending}
          aria-describedby={`${id}-help`}
        />
        <p className={styles.actionHelp} id={`${id}-help`}>
          Use blank lines between paragraphs. Keep a clear opt-out in your own
          words. No fixed word count is required.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.actionButton}
          data-variant="primary"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save revision"}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
