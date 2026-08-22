import { formatGrowthCurrency } from "@/lib/growth/dashboard/formatters";
import {
  OPEN_PIPELINE_STAGES,
  type PipelineBoardQuery,
  type PipelineBoardResult,
} from "@/lib/growth/dashboard/pipeline";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import { PipelineColumn } from "./pipeline-column";
import styles from "./pipeline.module.css";

export function PipelineBoard({
  query,
  state,
  now,
}: {
  query: PipelineBoardQuery;
  state: ViewState<PipelineBoardResult>;
  now: string;
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
    return null;
  }

  const { data } = state;
  const totalOpenCount = OPEN_PIPELINE_STAGES.reduce(
    (sum, stage) => sum + data.columns[stage].totalCount,
    0,
  );
  const totalOpenValuePence = OPEN_PIPELINE_STAGES.reduce(
    (sum, stage) => sum + data.columns[stage].valueTotalPence,
    0,
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Pipeline</h1>
          <p className={styles.subtitle}>
            Open commercial engagements from qualification through negotiation.
          </p>
        </div>
        <div className={styles.summary}>
          <p className={styles.summaryCount}>{totalOpenCount} open</p>
          <p className={styles.summaryValue}>
            {formatGrowthCurrency(totalOpenValuePence)} forecast
          </p>
        </div>
      </div>

      {totalOpenCount === 0 ? (
        <div className={styles.emptyState}>
          <p>No open opportunities yet. Prospects enter the pipeline once qualified.</p>
        </div>
      ) : (
        <div className={styles.board}>
          {OPEN_PIPELINE_STAGES.map((stage) => (
            <PipelineColumn
              column={data.columns[stage]}
              key={stage}
              now={now}
              query={query}
            />
          ))}
        </div>
      )}
    </div>
  );
}
