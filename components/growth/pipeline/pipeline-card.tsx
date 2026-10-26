import Link from "next/link";
import {
  formatGrowthCurrency,
  formatGrowthRelativeDay,
} from "@/lib/growth/dashboard/formatters";
import type { PipelineCardRow } from "@/lib/growth/dashboard/pipeline";

import { StageTransitionForm } from "./stage-transition-form";
import styles from "./pipeline.module.css";

export function PipelineCard({
  row,
  now,
}: {
  row: PipelineCardRow;
  now: string;
}) {
  return (
    <article className={styles.card}>
      <p className={styles.cardBusiness}>
        <Link href={`/growth/deals/${row.engagementId}`}>
          {row.businessName}
        </Link>
      </p>
      {row.primaryContactName && (
        <p className={styles.cardContact}>{row.primaryContactName}</p>
      )}
      <p className={styles.cardOffer}>{row.offerFocus}</p>
      <p className={styles.cardValue}>
        {formatGrowthCurrency(row.oneOffValuePence)} one-off
        <small className={styles.cardMonthly}>
          {formatGrowthCurrency(row.monthlyValuePence)}/month ·{" "}
          {row.probabilityPercent}% probability
        </small>
      </p>
      {row.nextAction ? (
        <p className={styles.cardNextAction}>
          Next: {row.nextAction}
          {row.nextActionDueAt &&
            ` · ${formatGrowthRelativeDay(row.nextActionDueAt, now)}`}
        </p>
      ) : (
        <p className={styles.cardNextAction}>No next action set.</p>
      )}
      <StageTransitionForm
        currentStage={row.stage}
        engagementId={row.engagementId}
        version={row.version}
      />
    </article>
  );
}
