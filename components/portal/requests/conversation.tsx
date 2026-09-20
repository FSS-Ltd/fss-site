"use client";

import { useState, type FormEvent } from "react";
import {
  PortalButton,
  PortalCard,
  PortalTextarea,
} from "@/components/portal/ui";
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
    <PortalCard className={styles.section} title="Latest conversation">
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
          <PortalTextarea
            disabled={pending}
            hint="Shared with your organisation and FSS. Do not include passwords or other credentials. Ask FSS for the agreed secure method to share files."
            label="Add a comment"
            maxLength={10000}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={4}
            value={body}
          />
          <PortalButton
            disabled={pending || !body.trim()}
            loading={pending}
            type="submit"
            variant="secondary"
          >
            {pending ? "Adding comment…" : "Add comment"}
          </PortalButton>
          <p className={styles.feedback} role="status" aria-atomic="true">
            {message}
          </p>
          {result && !result.ok && result.conflict && (
            <PortalButton onClick={onRefresh} type="button" variant="secondary">
              Refresh request details
            </PortalButton>
          )}
        </form>
      )}
    </PortalCard>
  );
}
