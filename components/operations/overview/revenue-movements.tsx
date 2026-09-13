import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { RevenueSummary } from "@/lib/operations/metrics/snapshot-types";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import styles from "./overview.module.css";

function absolute(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}

export function RevenueMovements({
  data,
}: {
  data: RevenueSummary;
}): React.JSX.Element {
  const items = [
    { name: "Start", value: data.start, reduction: false },
    { name: "New", value: data.new, reduction: false },
    { name: "Expansion", value: data.expansion, reduction: false },
    { name: "Reactivation", value: data.reactivation, reduction: false },
    { name: "Contraction", value: data.contraction, reduction: true },
    { name: "Churn", value: data.churn, reduction: true },
    { name: "End", value: data.active, reduction: false },
  ];
  const largestAbsolute = items.reduce((largest, item) => {
    const itemAbsolute = absolute(BigInt(item.value));
    return itemAbsolute > largest ? itemAbsolute : largest;
  }, BigInt(0));
  const widthDenominator = largestAbsolute || BigInt(1);

  return (
    <section
      id="movements"
      className={`${sharedStyles.panel} ${styles.section}`}
    >
      <h2>MRR movements</h2>
      <figure
        aria-label="MRR movement visual"
        className={styles.movementFigure}
      >
        <figcaption className={styles.movementCaption}>
          Start + new + expansion + reactivation − contraction − churn = end.
          Net movements per organisation, using recorded contracts.
        </figcaption>
        <ol className={styles.movementPlot}>
          {items.map((item) => {
            const value = BigInt(item.value);
            const magnitude = absolute(value);
            const width =
              Number((magnitude * BigInt(10000)) / widthDenominator) / 100;
            const displayValue = item.reduction ? -magnitude : value;

            return (
              <li className={styles.movementRow} key={item.name}>
                <div className={styles.movementLabel}>
                  <span>{item.name}</span>
                  <strong className={item.reduction ? styles.reduction : ""}>
                    {formatMoney(displayValue, BigInt(12))}
                  </strong>
                </div>
                <span className={styles.movementTrack} aria-hidden="true">
                  <span
                    className={item.reduction ? styles.reduction : ""}
                    style={{ width: `${width}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      </figure>
      <div
        className={`${sharedStyles.scrollRegion} ${styles.scroll}`}
        tabIndex={0}
        role="region"
        aria-label="MRR movements table, scroll horizontally"
      >
        <table>
          <caption>
            Monthly revenue in GBP; exact units are twelfths of a penny.
          </caption>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">GBP</th>
              <th scope="col">Exact units</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <th scope="row">{item.name}</th>
                <td>{formatMoney(BigInt(item.value), BigInt(12))}</td>
                <td>{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Gross revenue retention:{" "}
        {formatRatio(ratio(BigInt(data.capped), BigInt(data.start)))} · Net
        revenue retention:{" "}
        {formatRatio(ratio(BigInt(data.cohortEnd), BigInt(data.start)))} ·
        Starting MRR denominator: {formatMoney(BigInt(data.start), BigInt(12))}
      </p>
    </section>
  );
}
