import { formatGrowthCurrency } from "@/lib/growth/dashboard/formatters";
import type { PipelineOverview } from "@/lib/growth/dashboard/overview";

import styles from "./overview.module.css";

const STAGE_COLORS: Record<string, string> = {
  new: "#0b8f98",
  qualified: "#2e6fdb",
  proposal: "#7c5cd4",
  negotiation: "#3730a3",
};

export function PipelineSummary({ pipeline }: { pipeline: PipelineOverview }) {
  const openStages = pipeline.stages.filter((stage) => stage.count > 0);

  return (
    <section aria-labelledby="pipeline-heading" className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle} id="pipeline-heading">
          Pipeline overview
        </h2>
      </div>

      <p className={styles.pipelineTotalLabel}>Total pipeline value</p>
      <p className={styles.pipelineTotalValue}>
        {formatGrowthCurrency(pipeline.totalValuePence)}
      </p>

      {openStages.length > 0 && (
        <div
          aria-hidden="true"
          className={styles.pipelineBar}
          role="presentation"
        >
          {openStages.map((stage) => (
            <span
              className={styles.pipelineSegment}
              key={stage.id}
              style={{
                background: STAGE_COLORS[stage.id],
                flexGrow: stage.count,
              }}
            />
          ))}
        </div>
      )}

      <dl className={styles.pipelineStages}>
        {pipeline.stages.map((stage) => (
          <div className={styles.pipelineStage} key={stage.id}>
            <dt className={styles.pipelineStageLabel}>
              <span
                aria-hidden="true"
                className={styles.pipelineDot}
                style={{ background: STAGE_COLORS[stage.id] }}
              />
              {stage.label}
            </dt>
            <dd className={styles.pipelineStageCount}>{stage.count}</dd>
            <dd className={styles.pipelineStageValue}>
              {formatGrowthCurrency(stage.valuePence)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
