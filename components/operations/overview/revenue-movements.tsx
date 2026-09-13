import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { RevenueSummary } from "@/lib/operations/metrics/snapshot-types";
import styles from "./overview.module.css";

type MovementTone = "brand" | "positive" | "critical";

function movementWidth(value: bigint, largest: bigint): string {
  if (largest === BigInt(0)) return "0%";
  return `${Number((value * BigInt(10000)) / largest) / 100}%`;
}

function MovementChart({
  items,
}: {
  items: readonly [string, string, MovementTone][];
}): React.JSX.Element {
  const largest = items.reduce((current, [, value]) => {
    const amount = BigInt(value);
    return amount > current ? amount : current;
  }, BigInt(0));

  return (
    <figure className={styles.movementChart}>
      <figcaption>
        <h3>Revenue movement at a glance</h3>
        <p>
          Bar lengths compare the size of each recorded monthly movement. The
          exact financial values remain in the table below.
        </p>
      </figcaption>
      <ul>
        {items.map(([name, value, tone]) => (
          <li key={name}>
            <div>
              <span>{name}</span>
              <strong>{formatMoney(BigInt(value), BigInt(12))}</strong>
            </div>
            <span aria-hidden="true" className={styles.movementTrack}>
              <span
                className={styles.movementFill}
                data-tone={tone}
                style={{ width: movementWidth(BigInt(value), largest) }}
              />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function RevenueMovements({
  data,
}: {
  data: RevenueSummary;
}): React.JSX.Element {
  const items: [string, string, MovementTone][] = [
    ["Start", data.start, "brand"],
    ["New", data.new, "positive"],
    ["Expansion", data.expansion, "positive"],
    ["Reactivation", data.reactivation, "positive"],
    ["Contraction", data.contraction, "critical"],
    ["Churn", data.churn, "critical"],
    ["End", data.active, "brand"],
  ];
  return (
    <section id="movements" className={styles.section}>
      <h2>MRR movements</h2>
      <p>
        Start + new + expansion + reactivation − contraction − churn = end. Net
        movements per organisation, using recorded contracts.
      </p>
      <MovementChart items={items} />
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
