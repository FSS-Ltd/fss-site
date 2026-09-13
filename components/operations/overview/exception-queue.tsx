import Link from "next/link";
import type { ExceptionRow } from "@/lib/operations/metrics/snapshot-types";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import styles from "./overview.module.css";
export function ExceptionQueue({
  rows,
  total,
  observedAt,
}: {
  rows: ExceptionRow[];
  total: number;
  observedAt: string;
}): React.JSX.Element {
  return (
    <section className={`${sharedStyles.panel} ${styles.section}`}>
      <h2>
        Action queue <span>({total.toLocaleString("en-GB")})</span>
      </h2>
      <p>
        Current exceptions, ordered by severity then age. Renewal decisions
        cover the next 30 days.
      </p>
      {rows.length === 0 ? (
        <p>No matching actions on this page.</p>
      ) : (
        <ul className={styles.actions}>
          {rows.map((row) => (
            <li
              className={`${sharedStyles.panel} ${styles.actionRow}`}
              key={`${row.severity}:${row.id}`}
            >
              <div>
                <strong>{row.client}</strong>
                <p>{row.reason.replaceAll("_", " ")}</p>
                <p>
                  {row.owner} ·{" "}
                  {(() => {
                    const days = Math.max(
                      0,
                      Math.floor(
                        (Date.parse(observedAt) - Date.parse(row.since)) /
                          86400000,
                      ),
                    );
                    return `${days} ${days === 1 ? "day" : "days"}`;
                  })()}{" "}
                  · Since {row.since.slice(0, 10)}
                </p>
              </div>
              <Link className={styles.actionLink} href={row.href}>
                {row.nextStep}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
