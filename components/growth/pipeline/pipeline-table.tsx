import Link from "next/link";
import {
  formatGrowthCurrency,
  formatGrowthRelativeDay,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import {
  buildPipelineBoardHref,
  OPEN_PIPELINE_STAGES,
  type PipelineBoardQuery,
  type PipelineBoardResult,
} from "@/lib/growth/dashboard/pipeline";
import { StageTransitionForm } from "./stage-transition-form";
import styles from "./workspace.module.css";
import baseStyles from "./pipeline.module.css";
export function PipelineTable({
  data,
  query,
  now,
}: {
  data: PipelineBoardResult;
  query: PipelineBoardQuery;
  now: string;
}) {
  return (
    <>
      <div
        className={styles.tableScroll}
        tabIndex={0}
        role="region"
        aria-label="Scrollable pipeline list"
      >
        <table className={styles.table}>
          <caption className={baseStyles.visuallyHidden}>
            Open opportunities matching current filters
          </caption>
          <thead>
            <tr>
              <th scope="col">Company / opportunity</th>
              <th scope="col">Stage</th>
              <th scope="col">Forecast</th>
              <th scope="col">Next step</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {OPEN_PIPELINE_STAGES.flatMap((stage) =>
              data.columns[stage].rows.map((row) => (
                <tr key={row.engagementId}>
                  <th scope="row">
                    <Link href={`/growth/deals/${row.engagementId}`}>
                      {row.businessName}
                    </Link>
                    <small>{row.offerFocus}</small>
                    {row.primaryContactName && (
                      <small>{row.primaryContactName}</small>
                    )}
                  </th>
                  <td>{formatGrowthStatusLabel(row.stage)}</td>
                  <td>
                    {formatGrowthCurrency(row.oneOffValuePence)} one-off
                    <small>
                      {formatGrowthCurrency(row.monthlyValuePence)}/month
                    </small>
                  </td>
                  <td>
                    {row.nextAction ?? "No next step"}
                    {row.nextActionDueAt && (
                      <small>
                        {formatGrowthRelativeDay(row.nextActionDueAt, now)}
                      </small>
                    )}
                  </td>
                  <td>
                    <StageTransitionForm
                      currentStage={row.stage}
                      engagementId={row.engagementId}
                      version={row.version}
                    />
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <nav className={styles.viewLinks} aria-label="Pipeline list pagination">
        {OPEN_PIPELINE_STAGES.map(
          (stage) =>
            data.columns[stage].nextCursor && (
              <Link
                key={stage}
                href={buildPipelineBoardHref(query, {
                  [stage]: data.columns[stage].nextCursor!,
                })}
              >
                Next {formatGrowthStatusLabel(stage).toLowerCase()} page
              </Link>
            ),
        )}
      </nav>
    </>
  );
}
