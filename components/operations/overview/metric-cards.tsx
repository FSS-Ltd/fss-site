import Link from "next/link";
import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { MetricsSnapshot } from "@/lib/operations/metrics/snapshot-types";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import styles from "./overview.module.css";
export function MetricCards({
  data,
}: {
  data: MetricsSnapshot;
}): React.JSX.Element {
  const r = data.revenue;
  const cards = [
    {
      title: "Active MRR",
      value: formatMoney(BigInt(r.active), BigInt(12)),
      definition:
        "Net recurring contracted service effective at period end, normalized monthly. Excludes tax and one-off work.",
      href: "#services",
    },
    {
      title: "Annualised run-rate ARR",
      value: formatMoney(BigInt(r.active) * BigInt(12), BigInt(12)),
      definition:
        "12 × active MRR. A run rate, not cash or guaranteed annual sales.",
      href: "#services",
    },
    {
      title: "Signed, awaiting activation",
      value: formatMoney(BigInt(r.awaiting), BigInt(12)),
      definition:
        "Monthly equivalent of verified signed recurring lines not yet activated at period end.",
      href: "#services",
    },
    {
      title: "Overdue balance",
      value:
        data.receivables && data.freshness !== "unknown"
          ? formatMoney(BigInt(data.receivables.overdue))
          : "Unavailable",
      definition:
        "Positive current invoice balance after contractual due date in Europe/London. Processing and disputed balances remain visible.",
      href: "#receivables",
    },
    {
      title: "Client retention",
      value: formatRatio(ratio(BigInt(r.retained), BigInt(r.cohort))),
      definition: `Starting recurring-client cohort retained at period end. ${r.retained} retained / ${r.cohort} starting clients. Recorded contracts only.`,
      href: "#movements",
    },
  ];
  return (
    <div className={sharedStyles.metricGrid}>
      {cards.map((card) => (
        <article
          key={card.title}
          className={`${sharedStyles.metricCard} ${styles.card}`}
        >
          <h2>{card.title}</h2>
          <p className={styles.value}>{card.value}</p>
          <p>
            {card.title === "Client retention"
              ? `${r.cohort} starting clients`
              : "GBP"}{" "}
            · {data.filters.to}
          </p>
          <details>
            <summary>Definition</summary>
            <p>{card.definition}</p>
          </details>
          <Link href={card.href}>View supporting records</Link>
        </article>
      ))}
    </div>
  );
}
