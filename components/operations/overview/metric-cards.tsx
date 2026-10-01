import type { Currency } from "@/lib/operations/money";
import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { MetricsSnapshot } from "@/lib/operations/metrics/snapshot-types";
import {
  DashboardMetric,
  type DashboardTone,
} from "../dashboard/dashboard-visuals";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";

function movementSignal(
  current: bigint,
  previous: bigint,
  currency: Currency,
): { label: string; tone: DashboardTone } {
  const change = current - previous;

  if (change > BigInt(0)) {
    return {
      label: `${formatMoney(change, BigInt(12), currency)} higher than period start`,
      tone: "positive",
    };
  }

  if (change < BigInt(0)) {
    return {
      label: `${formatMoney(-change, BigInt(12), currency)} lower than period start`,
      tone: "critical",
    };
  }

  return { label: "No movement from period start", tone: "neutral" };
}
export function MetricCards({
  data,
}: {
  data: MetricsSnapshot;
}): React.JSX.Element {
  const r = data.revenue;
  const mrrSignal = movementSignal(
    BigInt(r.active),
    BigInt(r.start),
    data.filters.currency,
  );
  const overdue = data.receivables ? BigInt(data.receivables.overdue) : null;
  const cards = [
    {
      label: "Active MRR",
      value: formatMoney(BigInt(r.active), BigInt(12), data.filters.currency),
      supportingText: `Contracted recurring revenue at ${data.filters.to}.`,
      signal: mrrSignal,
      definition:
        "Net recurring contracted service effective at period end, normalized monthly. Excludes tax and one-off work.",
      href: "#services",
    },
    {
      label: "Annualised run-rate ARR",
      value: formatMoney(
        BigInt(r.active) * BigInt(12),
        BigInt(12),
        data.filters.currency,
      ),
      supportingText:
        "A 12-month view of current active MRR, not cash received.",
      signal: mrrSignal,
      definition:
        "12 × active MRR. A run rate, not cash or guaranteed annual sales.",
      href: "#services",
    },
    {
      label: "Signed, awaiting activation",
      value: formatMoney(BigInt(r.awaiting), BigInt(12), data.filters.currency),
      supportingText:
        "Signed recurring work that is not yet contributing to active MRR.",
      signal:
        BigInt(r.awaiting) > BigInt(0)
          ? { label: "Activation work is waiting", tone: "warning" as const }
          : {
              label: "No signed recurring work is waiting",
              tone: "positive" as const,
            },
      definition:
        "Monthly equivalent of verified signed recurring lines not yet activated at period end.",
      href: "#services",
    },
    {
      label: "Overdue balance",
      value:
        data.receivables && data.freshness !== "unknown"
          ? formatMoney(
              BigInt(data.receivables.overdue),
              BigInt(1),
              data.filters.currency,
            )
          : "Unavailable",
      supportingText:
        data.receivables && data.freshness !== "unknown"
          ? "Current invoice balance past its contractual due date."
          : "Provider reconciliation does not support a reliable balance.",
      signal:
        overdue === null || data.freshness === "unknown"
          ? { label: "Reconciliation unavailable", tone: "neutral" as const }
          : overdue > BigInt(0)
            ? { label: "Collection review required", tone: "critical" as const }
            : { label: "No overdue balance", tone: "positive" as const },
      definition:
        "Positive current invoice balance after contractual due date in Europe/London. Processing and disputed balances remain visible.",
      href: "#receivables",
    },
    {
      label: "Client retention",
      value: formatRatio(ratio(BigInt(r.retained), BigInt(r.cohort))),
      supportingText: `${r.retained} of ${r.cohort} clients in the starting recurring cohort remain.`,
      signal:
        BigInt(r.cohort) === BigInt(0)
          ? {
              label: "No starting cohort in this period",
              tone: "neutral" as const,
            }
          : { label: "Recorded contract cohort", tone: "brand" as const },
      definition: `Starting recurring-client cohort retained at period end. ${r.retained} retained / ${r.cohort} starting clients. Recorded contracts only.`,
      href: "#movements",
    },
  ];
  return (
    <div className={sharedStyles.metricGrid}>
      {cards.map((card) => (
        <DashboardMetric
          action={{ href: card.href, label: "View supporting records" }}
          definition={card.definition}
          key={card.label}
          label={card.label}
          signal={card.signal}
          supportingText={card.supportingText}
          value={card.value}
        />
      ))}
    </div>
  );
}
