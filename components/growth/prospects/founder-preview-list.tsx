import Link from "next/link";

import type {
  FounderDraftProspectPreviewSummary,
} from "@/lib/growth/prospect-previews/founder-review";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import { PreviewApproval } from "./preview-approval";
import styles from "./prospects.module.css";

export function FounderPreviewList({
  state,
}: {
  state: ViewState<readonly FounderDraftProspectPreviewSummary[]>;
}) {
  if (state.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{state.message}</p>
        <p className={styles.errorCorrelation}>Reference: {state.correlationId}</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className={styles.emptyState}>
        {state.reason}
      </div>
    );
  }

  return (
    <div className={styles.previewReviewPage}>
      <div className={styles.previewReviewHeader}>
        <div>
          <p className={styles.previewReviewEyebrow}>Founder review</p>
          <h1 className={styles.previewReviewHeading}>Concept previews</h1>
          <p className={styles.previewReviewDescription}>
            Review each private site concept before it is published for a prospect.
          </p>
        </div>
        <Link className={styles.rowLink} href="/growth/prospects">
          Back to prospects
        </Link>
      </div>

      <p className={styles.previewReviewCount}>
        {state.data.length} {state.data.length === 1 ? "preview is" : "previews are"} awaiting review.
      </p>

      <ul className={styles.previewReviewList} aria-label="Private concept previews">
        {state.data.map((preview) => (
          <li className={styles.previewReviewCard} key={preview.prospectId}>
            <div className={styles.previewReviewCardHeader}>
              <div>
                <h2 className={styles.previewReviewCardHeading}>{preview.businessName}</h2>
                <p className={styles.previewReviewCardDescription}>
                  Draft website concept, ready for founder review.
                </p>
              </div>
              <Link
                className={styles.rowLink}
                href={`/growth/prospects/${preview.prospectId}/preview`}
              >
                View concept preview
              </Link>
            </div>
            <div className={styles.previewReviewApproval}>
              <PreviewApproval
                preview={{
                  status: "draft",
                  version: preview.previewVersion,
                  compositionDigest: preview.compositionDigest,
                  generationPrNumber: preview.generationPrNumber,
                  generationStatus: preview.generationStatus,
                }}
                prospectId={preview.prospectId}
                prospectStatus={preview.prospectStatus}
                prospectVersion={preview.prospectVersion}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
