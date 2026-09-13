import Link from "next/link";
import styles from "./dashboard-visuals.module.css";

export type DashboardTone =
  | "brand"
  | "positive"
  | "warning"
  | "critical"
  | "neutral";

type MetricSignal = {
  label: string;
  tone: DashboardTone;
};

type DistributionItem = {
  label: string;
  value: number;
  tone: DashboardTone;
};

const chartColours: Record<DashboardTone, string> = {
  brand: "#14989e",
  positive: "#2f7d5b",
  warning: "#b7791f",
  critical: "#b74c45",
  neutral: "#8a99aa",
};

function pluralise(
  value: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${value.toLocaleString("en-GB")} ${value === 1 ? singular : plural}`;
}

function chartGradient(items: readonly DistributionItem[]): string {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  if (total === 0) return "conic-gradient(#dfe7ed 0deg 360deg)";

  let position = 0;
  const stops = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = position;
      position += (item.value / total) * 360;
      return `${chartColours[item.tone]} ${start}deg ${position}deg`;
    });

  return `conic-gradient(${stops.join(", ")})`;
}

export function DashboardMetric({
  label,
  value,
  supportingText,
  signal,
  definition,
  action,
}: {
  label: string;
  value: string;
  supportingText: string;
  signal?: MetricSignal;
  definition?: string;
  action?: { href: string; label: string };
}): React.JSX.Element {
  return (
    <article className={styles.metric} data-tone={signal?.tone ?? "brand"}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{value}</p>
      <p className={styles.metricSupportingText}>{supportingText}</p>
      {signal ? (
        <p className={styles.metricSignal} data-tone={signal.tone}>
          <span aria-hidden="true">●</span>
          {signal.label}
        </p>
      ) : null}
      {definition ? (
        <details className={styles.metricDefinition}>
          <summary>Definition</summary>
          <p>{definition}</p>
        </details>
      ) : null}
      {action ? (
        <Link className={styles.metricAction} href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </article>
  );
}

export function DonutChart({
  title,
  description,
  segments,
  centerLabel = "Total",
}: {
  title: string;
  description: string;
  segments: readonly DistributionItem[];
  centerLabel?: string;
}): React.JSX.Element {
  const total = segments.reduce(
    (sum, item) => sum + Math.max(0, item.value),
    0,
  );

  return (
    <figure className={styles.donutFigure}>
      <div
        aria-hidden="true"
        className={styles.donut}
        style={{ background: chartGradient(segments) }}
      >
        <div className={styles.donutCenter}>
          <strong>{total.toLocaleString("en-GB")}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <figcaption className={styles.chartCaption}>
        <h3>{title}</h3>
        <p>{description}</p>
        <ul className={styles.legend}>
          {segments.map((segment) => (
            <li key={segment.label}>
              <span aria-hidden="true" data-tone={segment.tone} />
              <span>{segment.label}</span>
              <strong>{pluralise(segment.value, "item")}</strong>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function DistributionBars({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: readonly DistributionItem[];
}): React.JSX.Element {
  const greatestValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <figure className={styles.barFigure}>
      <figcaption className={styles.chartCaption}>
        <h3>{title}</h3>
        <p>{description}</p>
      </figcaption>
      <ul className={styles.bars}>
        {items.map((item) => (
          <li key={item.label}>
            <div className={styles.barLabels}>
              <span>{item.label}</span>
              <strong>{pluralise(item.value, "item")}</strong>
            </div>
            <span aria-hidden="true" className={styles.barTrack}>
              <span
                className={styles.barFill}
                data-tone={item.tone}
                style={{
                  width: `${(Math.max(0, item.value) / greatestValue) * 100}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
