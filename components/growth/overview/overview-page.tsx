import { TriangleAlert } from "lucide-react";

import { formatGrowthDate } from "@/lib/growth/dashboard/formatters";
import type { OverviewViewModel } from "@/lib/growth/dashboard/overview";
import type {
  IntegrationHealth,
  ViewState,
} from "@/lib/growth/dashboard/view-models";

import styles from "./overview.module.css";
import { PipelineSummary } from "./pipeline-summary";
import { SequenceHealth } from "./sequence-health";
import { SummaryStrip } from "./summary-strip";
import { UpcomingActions } from "./upcoming-actions";
import { WorkQueue } from "./work-queue";

function integrationAdvisory(
  integrations: readonly IntegrationHealth[],
): string | null {
  const gmail = integrations.find((integration) => integration.provider === "gmail");
  const cron = integrations.find((integration) => integration.provider === "cron");

  if (gmail && gmail.status !== "healthy") {
    return "Gmail is disconnected. Reconnect it in Settings before approving new emails.";
  }

  if (cron && cron.status === "disabled") {
    return "Automations are paused. Approved emails will not send until they are re-enabled in Settings.";
  }

  return null;
}

export function OverviewPage({
  integrations,
  now,
  state,
}: {
  integrations: readonly IntegrationHealth[];
  now: string;
  state: ViewState<OverviewViewModel>;
}) {
  const advisory = integrationAdvisory(integrations);

  if (state.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{state.message}</p>
        <p className={styles.errorCorrelation}>Reference: {state.correlationId}</p>
      </div>
    );
  }

  return (
    <div className={styles.pageChrome}>
      {advisory && (
        <p className={styles.advisory} role="status">
          <TriangleAlert
            aria-hidden="true"
            size={18}
            strokeWidth={1.8}
            style={{ flex: "none" }}
          />
          <span>{advisory}</span>
        </p>
      )}

      <div className={styles.header}>
        <div>
          <h1 className={styles.headerDate}>{formatGrowthDate(now)}</h1>
          <p className={styles.headerSubtitle}>Founder workspace</p>
        </div>
      </div>

      {state.status === "empty" ? (
        <div className={styles.emptyState}>
          <p>{state.reason}</p>
        </div>
      ) : (
        <div className={styles.page}>
          <div className={styles.strip}>
            <SummaryStrip summary={state.data.summary} />
          </div>
          <div className={styles.queue}>
            <WorkQueue
              defaultTab={state.data.defaultWorkQueueTab}
              now={now}
              tabs={state.data.workQueue}
            />
          </div>
          <div className={styles.pipeline}>
            <PipelineSummary pipeline={state.data.pipeline} />
          </div>
          <div className={styles.actions}>
            <UpcomingActions actions={state.data.upcomingActions} now={now} />
          </div>
          <div className={styles.health}>
            <SequenceHealth health={state.data.sequenceHealth} />
          </div>
        </div>
      )}
    </div>
  );
}
