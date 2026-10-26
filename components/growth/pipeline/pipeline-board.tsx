import Link from "next/link";
import { pipelineFiltersSchema } from "@/lib/growth/crm/schemas";
import type { SavedCrmView } from "@/lib/growth/crm/workspace-query";
import { SavedViews } from "../crm/saved-views";
import { PipelineToolbar } from "./pipeline-toolbar";
import { PipelineSummary } from "./pipeline-summary";
import { PipelineTable } from "./pipeline-table";
import {
  OPEN_PIPELINE_STAGES,
  type PipelineBoardQuery,
  type PipelineBoardResult,
} from "@/lib/growth/dashboard/pipeline";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import { PipelineColumn } from "./pipeline-column";
import styles from "./pipeline.module.css";
import workspaceStyles from "./workspace.module.css";

export function PipelineBoard({
  query,
  state,
  now,
  savedViews = [],
}: {
  query: PipelineBoardQuery;
  state: ViewState<PipelineBoardResult>;
  now: string;
  savedViews?: readonly SavedCrmView[];
}) {
  if (state.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{state.message}</p>
        <p className={styles.errorCorrelation}>
          Reference: {state.correlationId}
        </p>
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
  const filters = query.filters ?? pipelineFiltersSchema.parse({});

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Pipeline</h1>
          <p className={styles.subtitle}>
            Open commercial engagements from qualification through negotiation.
          </p>
        </div>
        <div className={workspaceStyles.viewLinks}>
          <Link href="/growth/deals">All deals</Link>
          <Link
            className={workspaceStyles.createButton}
            href="/growth/prospects/new"
          >
            New lead
          </Link>
        </div>
      </div>
      <PipelineToolbar filters={filters} />
      <SavedViews views={savedViews} filters={filters} />
      <PipelineSummary data={data} />

      {totalOpenCount === 0 ? (
        <div className={styles.emptyState}>
          <p>
            No opportunities match this view. Create a deal from a lead record,
            or clear the filters.
          </p>
        </div>
      ) : filters.view === "list" ? (
        <PipelineTable data={data} query={query} now={now} />
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
