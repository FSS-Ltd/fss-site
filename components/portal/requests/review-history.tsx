import type { RequestReview } from "@/lib/operations/requests/types";
import { requestDate } from "./presentation";
import { RequestDocuments } from "./request-documents";
import styles from "./requests.module.css";

export function RequestReviewHistory({
  reviews,
  organisationId,
  hidePortalActions,
}: {
  reviews: RequestReview[];
  organisationId: string;
  hidePortalActions: boolean;
}): React.JSX.Element | null {
  if (!reviews.length) return null;
  return (
    <section
      className={styles.section}
      aria-labelledby="review-history-heading"
    >
      <h2 id="review-history-heading" className={styles.sectionTitle}>
        Review history
      </h2>
      {reviews.length === 200 && (
        <p className={styles.note}>Showing the latest 200 review entries.</p>
      )}
      <ol className={styles.history}>
        {reviews.map((review, index) => (
          <li key={review.id}>
            <div className={styles.row}>
              <h3 className={styles.author}>
                {review.decision === "accepted"
                  ? "Accepted"
                  : review.decision === "changes_requested"
                    ? "Changes requested"
                    : "Review requested"}{" "}
                · {review.deliverableVersion}
              </h3>
              <time dateTime={review.createdAt} className={styles.note}>
                {requestDate(review.createdAt)}
              </time>
            </div>
            <p className={styles.note}>Review cycle {review.reviewCycle}</p>
            {review.feedback && (
              <p className={styles.prose}>{review.feedback}</p>
            )}
            {index ===
              reviews.findIndex(
                (entry) =>
                  entry.reviewCycle === review.reviewCycle &&
                  entry.deliverableVersion === review.deliverableVersion,
              ) && (
              <RequestDocuments
                documents={review.documents}
                organisationId={organisationId}
                hidePortalActions={hidePortalActions}
                headingId={`review-documents-${review.id}`}
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
