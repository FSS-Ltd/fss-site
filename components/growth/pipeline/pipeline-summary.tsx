import { formatGrowthCurrency } from "@/lib/growth/dashboard/formatters";
import {
  OPEN_PIPELINE_STAGES,
  type PipelineBoardResult,
} from "@/lib/growth/dashboard/pipeline";
import styles from "./workspace.module.css";
export function PipelineSummary({ data }: { data: PipelineBoardResult }) {
  const totals = OPEN_PIPELINE_STAGES.reduce(
    (sum, stage) => {
      const column = data.columns[stage];
      return {
        count: sum.count + column.totalCount,
        oneOff: sum.oneOff + column.oneOffTotalPence,
        monthly: sum.monthly + column.monthlyTotalPence,
        weightedOneOff: sum.weightedOneOff + column.weightedOneOffPence,
        weightedMonthly: sum.weightedMonthly + column.weightedMonthlyPence,
      };
    },
    { count: 0, oneOff: 0, monthly: 0, weightedOneOff: 0, weightedMonthly: 0 },
  );
  return (
    <section aria-label="Open pipeline forecast" className={styles.forecast}>
      <dl>
        <div>
          <dt>Open opportunities</dt>
          <dd>{totals.count}</dd>
        </div>
        <div>
          <dt>One-off forecast</dt>
          <dd>{formatGrowthCurrency(totals.oneOff)}</dd>
        </div>
        <div>
          <dt>Monthly forecast</dt>
          <dd>
            {formatGrowthCurrency(totals.monthly)}
            <small>/month</small>
          </dd>
        </div>
        <div>
          <dt>Weighted one-off</dt>
          <dd>{formatGrowthCurrency(totals.weightedOneOff)}</dd>
        </div>
        <div>
          <dt>Weighted monthly</dt>
          <dd>
            {formatGrowthCurrency(totals.weightedMonthly)}
            <small>/month</small>
          </dd>
        </div>
      </dl>
      <p>
        Weighted values apply each deal’s probability, rounded to pence.
        Forecasts exclude closed deals and are not recognised revenue.
      </p>
    </section>
  );
}
