import type { JourneyView } from "@/lib/operations/onboarding/command-types";
import { Notice, PortalCard, StatusBadge } from "@/components/portal/ui";

function journeyStatus(
  journey: JourneyView,
): "error" | "info" | "success" | "warning" {
  if (journey.failureCode) return "error";
  if (journey.state === "completed") return "success";
  if (journey.state === "paused" || journey.state === "blocked")
    return "warning";
  return "info";
}

export function StaffJourneyDetail({
  journey,
}: {
  journey: JourneyView;
}): React.JSX.Element {
  const acceptedJobs = journey.jobs.filter((job) => job.acceptedAt).length;
  const unresolvedJobs = journey.jobs.filter(
    (job) => job.uncertain || job.state === "unknown_outcome",
  ).length;

  return (
    <PortalCard title={journey.agreementTitle || "Client journey"}>
      <StatusBadge status={journeyStatus(journey)}>
        {journey.state.replaceAll("_", " ")}
      </StatusBadge>
      <dl>
        <div>
          <dt>Approved delivery steps</dt>
          <dd>{journey.jobs.length}</dd>
        </div>
        <div>
          <dt>Verified provider acceptance</dt>
          <dd>{acceptedJobs}</dd>
        </div>
      </dl>
      {unresolvedJobs ? (
        <Notice tone="warning">
          {unresolvedJobs} delivery{" "}
          {unresolvedJobs === 1 ? "outcome needs" : "outcomes need"}{" "}
          reconciliation. Do not retry an uncertain effect.
        </Notice>
      ) : null}
    </PortalCard>
  );
}
