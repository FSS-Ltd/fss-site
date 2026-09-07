"use client";

import { useState, type FormEvent } from "react";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import type { RequestAction } from "./actions";
import { useRequestAction } from "./use-request-action";
import { requestDate } from "./presentation";
import styles from "./requests.module.css";

export function RequestConversation({
  request,
  canComment,
  commandAction,
  onRefresh,
}: {
  request: ClientRequestDetail;
  canComment: boolean;
  commandAction: RequestAction;
  onRefresh: () => void;
}): React.JSX.Element {
  const [body, setBody] = useState("");
  const { pending, result, message, run } = useRequestAction(
    commandAction,
    onRefresh,
  );
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!body.trim()) return;
    if (
      await run(
        {
          action: "comment",
          expectedVersion: request.version,
          body: body.trim(),
        },
        "Comment added.",
      )
    )
      setBody("");
  }
  return (
    <section
      className={styles.section}
      aria-labelledby="request-conversation-heading"
    >
      <h2 id="request-conversation-heading" className={styles.sectionTitle}>
        Conversation
      </h2>
      {request.comments.length === 200 && (
        <p className={styles.note}>Showing the latest 200 comments.</p>
      )}
      {!request.comments.length ? (
        <p className={styles.empty}>
          No comments yet. Updates and replies shared with your organisation
          will appear here.
        </p>
      ) : (
        <ol className={styles.history}>
          {request.comments.map((comment) => (
            <li key={comment.id}>
              <div className={styles.row}>
                <h3 className={styles.author}>{comment.authorLabel}</h3>
                <time className={styles.note} dateTime={comment.createdAt}>
                  {requestDate(comment.createdAt)}
                </time>
              </div>
              <p className={styles.prose}>{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canComment && (
        <form className={styles.form} onSubmit={submit} aria-busy={pending}>
          <label className={styles.field}>
            Add a comment
            <textarea
              className={styles.input}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={10000}
              required
              rows={4}
              disabled={pending}
              aria-describedby="request-comment-note"
            />
          </label>
          <p id="request-comment-note" className={styles.note}>
            Shared with your organisation and FSS. Do not include passwords or
            other credentials. Ask FSS for the agreed secure method to share
            files.
          </p>
          <button
            type="submit"
            className={styles.secondary}
            disabled={pending || !body.trim()}
          >
            {pending ? "Adding comment…" : "Add comment"}
          </button>
          <p className={styles.feedback} role="status" aria-atomic="true">
            {message}
          </p>
          {result && !result.ok && result.conflict && (
            <button
              type="button"
              onClick={onRefresh}
              className={styles.secondary}
            >
              Refresh request details
            </button>
          )}
        </form>
      )}
    </section>
  );
}
