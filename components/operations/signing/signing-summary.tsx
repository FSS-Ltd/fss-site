import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import { DashboardMetric, DonutChart } from "../dashboard/dashboard-visuals";
import styles from "./signing.module.css";

export function SigningSummary({
  approvals,
}: {
  approvals: readonly SigningApproval[];
}): React.JSX.Element | null {
  if (approvals.length === 0) return null;

  const required = approvals.reduce(
    (sum, approval) => sum + approval.requiredSigners.length,
    0,
  );
  const recorded = approvals.reduce(
    (sum, approval) => sum + approval.signatures.length,
    0,
  );
  const awaitingFounderReview = approvals.filter(
    (approval) => approval.status === "prepared",
  ).length;
  const openForSigning = approvals.filter(
    (approval) => approval.status === "approved",
  ).length;

  return (
    <section
      className={styles.summary}
      aria-labelledby="signing-summary-heading"
    >
      <div className={styles.summaryHeading}>
        <p>Signing control</p>
        <h2 id="signing-summary-heading">Signature progress at a glance</h2>
        <span>
          A signature is recorded only after the approved document is accepted.
          Use the detail cards to review the exact document and signer status.
        </span>
      </div>
      <div className={styles.metrics}>
        <DashboardMetric
          label="Requests shown"
          supportingText="Signing approvals in the current organisation register."
          value={approvals.length.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Founder review"
          signal={
            awaitingFounderReview > 0
              ? { label: "Document approval is waiting", tone: "warning" }
              : {
                  label: "No document needs founder approval",
                  tone: "positive",
                }
          }
          supportingText="Prepared documents that need an explicit signing decision."
          value={awaitingFounderReview.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Open for signing"
          signal={
            openForSigning > 0
              ? { label: "Monitor signer progress", tone: "brand" }
              : { label: "No request is currently open", tone: "neutral" }
          }
          supportingText="Approved documents that still accept signatures."
          value={openForSigning.toLocaleString("en-GB")}
        />
      </div>
      <DonutChart
        centerLabel="Signatures"
        description={`${recorded.toLocaleString("en-GB")} of ${required.toLocaleString("en-GB")} required signatures have been recorded across the requests shown.`}
        segments={[
          { label: "Recorded", tone: "positive", value: recorded },
          {
            label: "Awaiting signature",
            tone: "warning",
            value: Math.max(required - recorded, 0),
          },
        ]}
        title="Required signature coverage"
      />
    </section>
  );
}
