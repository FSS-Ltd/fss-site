import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { RevenueSummary } from "@/lib/operations/metrics/snapshot-types";
import styles from "./overview.module.css";
export function RevenueMovements({
  data,
}: {
  data: RevenueSummary;
}): React.JSX.Element {
  const items = [
    ["Start", data.start],
    ["New", data.new],
    ["Expansion", data.expansion],
    ["Reactivation", data.reactivation],
    ["Contraction", data.contraction],
    ["Churn", data.churn],
    ["End", data.active],
  ];
  return (
    <section id="movements" className={styles.section}>
      <h2>MRR movements</h2>
      <p>
        Start + new + expansion + reactivation − contraction − churn = end. Net
        movements per organisation, using recorded contracts.
      </p>
      <div
        className={styles.scroll}
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
            {items.map(([name, value]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{formatMoney(BigInt(value), BigInt(12))}</td>
                <td>{value}</td>
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
