import Link from "next/link";

import { formatGrowthCurrency } from "@/lib/growth/dashboard/formatters";
import {
  buildPipelineBoardHref,
  type OpenPipelineStage,
  type PipelineBoardQuery,
  type PipelineColumn as PipelineColumnData,
} from "@/lib/growth/dashboard/pipeline";

import { PipelineCard } from "./pipeline-card";
import styles from "./pipeline.module.css";

const STAGE_LABELS: Record<OpenPipelineStage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
};

export function PipelineColumn({
  column,
  query,
  now,
}: {
  column: PipelineColumnData;
  query: PipelineBoardQuery;
  now: string;
}) {
  const headingId = `pipeline-column-${column.stage}`;

  return (
    <section aria-labelledby={headingId} className={styles.column}>
      <div className={styles.columnHeader}>
        <h2 className={styles.columnTitle} id={headingId}>
          {STAGE_LABELS[column.stage]}
        </h2>
        <p className={styles.columnMeta}>
          {column.totalCount} · {formatGrowthCurrency(column.valueTotalPence)}
        </p>
      </div>

      {column.rows.length === 0 ? (
        <p className={styles.columnEmpty}>No opportunities at this stage.</p>
      ) : (
        <ol className={styles.cardList}>
          {column.rows.map((row) => (
            <li key={row.engagementId}>
              <PipelineCard now={now} row={row} />
            </li>
          ))}
        </ol>
      )}

      {column.nextCursor && (
        <Link
          className={styles.columnMore}
          href={buildPipelineBoardHref(query, { [column.stage]: column.nextCursor })}
        >
          Load more {STAGE_LABELS[column.stage].toLowerCase()}
        </Link>
      )}
    </section>
  );
}
