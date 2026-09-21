"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Notice,
  PortalCard,
  StatusBadge,
  type PortalStatus,
} from "@/components/portal/ui";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import { postRequestCommand, type RequestAction } from "./actions";
import { RequestConversation } from "./conversation";
import { ReviewActions } from "./review-actions";
import { RequestAllowance } from "./allowance";
import { RequestDocuments } from "./request-documents";
import { RequestReviewHistory } from "./review-history";
import { requestDate, scopeLabels, statusLabels } from "./presentation";
import styles from "./requests.module.css";

function statusTone(status: ClientRequestDetail["status"]): PortalStatus {
  if (status === "done") return "success";
  if (status === "ready_for_review") return "info";
  if (status === "changes_requested") return "warning";
  return "neutral";
}

function latestAcceptance(request: ClientRequestDetail) {
  return request.reviews.find(
    (review) =>
      review.decision === "accepted" &&
      review.deliverableVersion === request.deliverableVersion,
  );
}

export function RequestDetail({
  request,
  organisationId,
  canComment,
  commandAction,
  hidePortalActions = false,
  hideTitle = false,
  initialConflict = false,
  initialReviewDecision,
  showReviewActions = true,
}: {
  request: ClientRequestDetail;
  organisationId: string;
  canComment: boolean;
  commandAction?: RequestAction;
  hidePortalActions?: boolean;
  hideTitle?: boolean;
  initialConflict?: boolean;
  initialReviewDecision?: "accept" | "request_changes";
  showReviewActions?: boolean;
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
  const acceptance = latestAcceptance(request);
  return (
    <article className={styles.detail}>
      <div className={styles.row}>
        <StatusBadge status={statusTone(request.status)}>
          {statusLabels[request.status]}
        </StatusBadge>
        <span className={styles.note}>{scopeLabels[request.scope]}</span>
      </div>
      {!hideTitle ? (
        <>
          <h1 className={styles.title}>{request.title}</h1>
          <p className={styles.note}>
            Submitted {requestDate(request.createdAt)}
          </p>
        </>
      ) : null}
      <Notice tone={request.status === "done" ? "success" : "info"}>
        <strong>Next step</strong>
        <p className={styles.noticeCopy}>
          {request.nextAction ||
            "Your FSS team will assess the request and confirm the next step."}
        </p>
      </Notice>
      {initialConflict && !showReviewActions ? (
        <Notice
          action={
            request.status === "ready_for_review" ? (
              <Link
                className={styles.followUpLink}
                href={`/portal/requests/${encodeURIComponent(request.id)}/review?organisationId=${encodeURIComponent(organisationId)}`}
              >
                Review the latest version
              </Link>
            ) : undefined
          }
          tone="warning"
        >
          <strong>This request has changed.</strong>
          <p className={styles.noticeCopy}>
            Review the current record before submitting a decision. No decision
            has been recorded from the stale version.
          </p>
        </Notice>
      ) : null}
      <PortalCard title="Request details">
        <dl className={styles.facts}>
          <div>
            <dt>Desired outcome</dt>
            <dd>{request.desiredOutcome}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{scopeLabels[request.scope]}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{requestDate(request.targetDate)}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{request.ownerDisplay || "To be confirmed"}</dd>
          </div>
        </dl>
        {request.scopeReason && (
          <p className={styles.prose}>{request.scopeReason}</p>
        )}
        {request.closureLabel && (
          <p className={styles.noticeCopy}>{request.closureLabel}</p>
        )}
      </PortalCard>
      <RequestAllowance allowance={request.allowance} />
      {request.blocked && (
        <Notice tone="warning">
          <strong>Blocked</strong>
          <p className={styles.prose}>{request.blocked.reason}</p>
          <p className={styles.copy}>
            Waiting on {request.blocked.responsibleParty}. Next check:{" "}
            {requestDate(request.blocked.nextCheckDate)}.
          </p>
        </Notice>
      )}
      <PortalCard className={styles.section} title="The request">
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
      </PortalCard>
      {!hidePortalActions && showReviewActions && (
        <ReviewActions
          request={request}
          commandAction={action}
          initialConflict={initialConflict}
          initialDecision={initialReviewDecision}
          onRefresh={() => router.refresh()}
        />
      )}
      {!hidePortalActions &&
      !showReviewActions &&
      request.status === "ready_for_review" ? (
        <PortalCard
          className={styles.section}
          description="Open the exact version before accepting it or asking FSS for changes."
          title="Your review is ready"
          tone="accent"
        >
          <Link
            className={styles.followUpLink}
            href={`/portal/requests/${encodeURIComponent(request.id)}/review?organisationId=${encodeURIComponent(organisationId)}`}
          >
            Review {request.deliverableVersion || "the update"}
          </Link>
        </PortalCard>
      ) : null}
      {(request.publicSummary || request.documents.length > 0) && (
        <PortalCard
          className={styles.section}
          title={`Deliverable${request.deliverableVersion ? ` · ${request.deliverableVersion}` : ""}`}
        >
          {request.publicSummary && (
            <p className={styles.prose}>{request.publicSummary}</p>
          )}
          <RequestDocuments
            documents={request.documents}
            organisationId={organisationId}
            hidePortalActions={hidePortalActions}
            headingId="current-request-documents"
          />
        </PortalCard>
      )}
      {request.status === "done" ? (
        <PortalCard
          className={styles.section}
          description={
            acceptance
              ? "The final files and review history are available below."
              : request.closureLabel ||
                "FSS has closed this request without a client acceptance."
          }
          title={
            acceptance
              ? `Version ${acceptance.deliverableVersion} accepted.`
              : "FSS closed this request."
          }
          tone="accent"
        >
          {!hidePortalActions ? (
            <>
              <Link
                className={styles.followUpLink}
                href={`/portal/requests/new?organisationId=${encodeURIComponent(organisationId)}`}
              >
                Start a follow-up request
              </Link>
              <p className={styles.note}>
                A follow-up is a new request, so it does not change this
                completed record.
              </p>
              {acceptance ? (
                <p className={styles.note}>
                  Accepted {requestDate(acceptance.createdAt)}. The review
                  history contains the recorded acceptance details.
                </p>
              ) : null}
            </>
          ) : null}
        </PortalCard>
      ) : null}
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
