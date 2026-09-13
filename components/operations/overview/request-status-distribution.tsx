import { DonutChart, type DashboardTone } from "../dashboard/dashboard-visuals";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function statusTone(status: string): DashboardTone {
  if (status === "done") return "positive";
  if (status === "new" || status === "changes_requested") return "critical";
  if (status === "ready_for_review") return "warning";
  if (status === "in_progress" || status === "planned") return "brand";
  return "neutral";
}

export function RequestStatusDistribution({
  requests,
}: {
  requests: readonly { status: string; count: number }[];
}): React.JSX.Element | null {
  if (requests.length === 0) return null;

  const total = requests.reduce((sum, request) => sum + request.count, 0);
  const actionable = requests
    .filter((request) => !["done", "cancelled"].includes(request.status))
    .reduce((sum, request) => sum + request.count, 0);

  return (
    <DonutChart
      centerLabel="Requests"
      description={`${actionable.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} matching requests remain actionable. Counts cover the current Operations report filters.`}
      segments={requests.map((request) => ({
        label: statusLabel(request.status),
        tone: statusTone(request.status),
        value: request.count,
      }))}
      title="Request status mix"
    />
  );
}
