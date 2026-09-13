import type { ClientRequest } from "@/lib/operations/requests/types";
import {
  DashboardMetric,
  DonutChart,
  type DashboardTone,
} from "../dashboard/dashboard-visuals";
import styles from "./requests.module.css";

function statusTone(status: ClientRequest["status"]): DashboardTone {
  if (status === "done") return "positive";
  if (status === "new" || status === "changes_requested") return "critical";
  if (status === "ready_for_review") return "warning";
  if (status === "in_progress" || status === "planned") return "brand";
  return "neutral";
}

export function RequestQueueSummary({
  requests,
  observedAt,
}: {
  requests: readonly ClientRequest[];
  observedAt: number;
}): React.JSX.Element | null {
  if (requests.length === 0) return null;

  const open = requests.filter(
    (request) => !["done", "cancelled"].includes(request.status),
  ).length;
  const acknowledgementOverdue = requests.filter(
    (request) =>
      request.status === "new" &&
      Date.parse(request.acknowledgementTarget) < observedAt,
  ).length;
  const reviewFollowUpDue = requests.filter(
    (request) =>
      request.status === "ready_for_review" &&
      request.reviewReminderTarget !== null &&
      Date.parse(request.reviewReminderTarget) < observedAt,
  ).length;
  const statusCounts = new Map<ClientRequest["status"], number>();

  for (const request of requests) {
    statusCounts.set(
      request.status,
      (statusCounts.get(request.status) ?? 0) + 1,
    );
  }

  return (
    <section
      className={styles.summary}
      aria-labelledby="request-summary-heading"
    >
      <div className={styles.summaryHeading}>
        <p>Queue health</p>
        <h2 id="request-summary-heading">Work that needs a clear next step</h2>
        <span>
          Review late acknowledgements and review follow-ups first. Counts cover
          the requests shown on this page.
        </span>
      </div>
      <div className={styles.metrics}>
        <DashboardMetric
          label="Open work"
          supportingText="Requests not yet done or cancelled."
          value={open.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Acknowledgement overdue"
          signal={
            acknowledgementOverdue > 0
              ? { label: "Client response is waiting", tone: "critical" }
              : { label: "No overdue acknowledgement", tone: "positive" }
          }
          supportingText="New requests past their acknowledgement target."
          value={acknowledgementOverdue.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Review follow-up due"
          signal={
            reviewFollowUpDue > 0
              ? { label: "Check the outstanding review", tone: "warning" }
              : { label: "No review follow-up is due", tone: "positive" }
          }
          supportingText="Ready-for-review requests past their reminder date."
          value={reviewFollowUpDue.toLocaleString("en-GB")}
        />
      </div>
      <DonutChart
        centerLabel="Requests"
        description={`${open.toLocaleString("en-GB")} of ${requests.length.toLocaleString("en-GB")} requests shown are still open. Each segment names the current work state.`}
        segments={[...statusCounts.entries()].map(([status, value]) => ({
          label: status.replaceAll("_", " "),
          tone: statusTone(status),
          value,
        }))}
        title="Work by state"
      />
    </section>
  );
}
