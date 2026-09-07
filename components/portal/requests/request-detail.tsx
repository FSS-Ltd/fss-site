"use client";

import { useRouter } from "next/navigation";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import { postRequestCommand, type RequestAction } from "./actions";
import { RequestConversation } from "./conversation";
import { ReviewActions } from "./review-actions";
import { RequestAllowance } from "./allowance";
import { RequestDocuments } from "./request-documents";
import { RequestReviewHistory } from "./review-history";
import { requestDate, scopeLabels, statusLabels } from "./presentation";
import styles from "./requests.module.css";

export function RequestDetail({
  request,
  organisationId,
  canComment,
  commandAction,
  hidePortalActions = false,
}: {
  request: ClientRequestDetail;
  organisationId: string;
  canComment: boolean;
  commandAction?: RequestAction;
  hidePortalActions?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const action: RequestAction =
    commandAction ??
    ((command) =>
      postRequestCommand(
        `/api/portal/requests/${encodeURIComponent(request.id)}/actions`,
        organisationId,
        command,
      ));
  return (
    <article className={styles.detail}>
      <div className={styles.row}>
        <span
          className={styles.status}
          data-review={request.status === "ready_for_review"}
        >
          {statusLabels[request.status]}
        </span>
        <span className={styles.note}>{scopeLabels[request.scope]}</span>
      </div>
      <h1 className={styles.title}>{request.title}</h1>
      <p className={styles.note}>Submitted {requestDate(request.createdAt)}</p>
      <div className={styles.overview}>
        <p className={styles.eyebrow}>Next step</p>
        <p className={styles.nextAction}>
          {request.nextAction ||
            "Your FSS team will assess the request and confirm the next step."}
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>Owner</dt>
            <dd>{request.ownerDisplay || "To be confirmed"}</dd>
          </div>
          <div>
            <dt>Target date</dt>
            <dd>{requestDate(request.targetDate)}</dd>
          </div>
          <div>
            <dt>Acknowledgement target</dt>
            <dd>{requestDate(request.acknowledgementTarget)}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{scopeLabels[request.scope]}</dd>
          </div>
        </dl>
        {request.scopeReason && (
          <p className={styles.prose}>{request.scopeReason}</p>
        )}
        {request.closureLabel && (
          <p className={styles.notice}>{request.closureLabel}</p>
        )}
      </div>
      <RequestAllowance allowance={request.allowance} />
      {request.blocked && (
        <aside className={styles.notice} aria-label="Request blocked">
          <h2 className={styles.sectionTitle}>Blocked</h2>
          <p className={styles.prose}>{request.blocked.reason}</p>
          <p className={styles.copy}>
            Waiting on {request.blocked.responsibleParty}. Next check:{" "}
            {requestDate(request.blocked.nextCheckDate)}.
          </p>
        </aside>
      )}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The request</h2>
        <p className={styles.prose}>{request.description}</p>
        <h3 className={styles.subheading}>Desired outcome</h3>
        <p className={styles.prose}>{request.desiredOutcome}</p>
        {request.desiredDate && (
          <p className={styles.copy}>
            Requested date: {requestDate(request.desiredDate)}. Agreed
            scheduling appears above.
          </p>
        )}
        {request.impact && (
          <>
            <h3 className={styles.subheading}>Impact</h3>
            <p className={styles.prose}>{request.impact}</p>
          </>
        )}
        {request.type === "bug" && (
          <dl className={styles.bugDetails}>
            <div>
              <dt>Steps to reproduce</dt>
              <dd>{request.reproductionSteps}</dd>
            </div>
            <div>
              <dt>Expected behaviour</dt>
              <dd>{request.expectedBehaviour}</dd>
            </div>
            <div>
              <dt>Actual behaviour</dt>
              <dd>{request.actualBehaviour}</dd>
            </div>
          </dl>
        )}
      </section>
      {(request.publicSummary || request.documents.length > 0) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Deliverable
            {request.deliverableVersion
              ? ` · ${request.deliverableVersion}`
              : ""}
          </h2>
          {request.publicSummary && (
            <p className={styles.prose}>{request.publicSummary}</p>
          )}
          <RequestDocuments
            documents={request.documents}
            organisationId={organisationId}
            hidePortalActions={hidePortalActions}
            headingId="current-request-documents"
          />
        </section>
      )}
      {!hidePortalActions && (
        <ReviewActions
          request={request}
          commandAction={action}
          onRefresh={() => router.refresh()}
        />
      )}
      <RequestConversation
        request={request}
        canComment={canComment}
        commandAction={action}
        onRefresh={() => router.refresh()}
      />
      <RequestReviewHistory
        reviews={request.reviews}
        organisationId={organisationId}
        hidePortalActions={hidePortalActions}
      />
    </article>
  );
}
