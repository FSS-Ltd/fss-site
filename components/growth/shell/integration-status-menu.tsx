import { CircleGauge } from "lucide-react";

import type {
  IntegrationHealth,
  IntegrationStatus,
} from "@/lib/growth/dashboard/view-models";

import styles from "./shell.module.css";

const providerLabels = {
  database: "Database",
  gmail: "Gmail",
  resend: "Resend",
  codex: "Codex",
  cron: "Automations",
} as const;

const statusPriority: Record<IntegrationStatus, number> = {
  healthy: 0,
  disabled: 0,
  disconnected: 2,
  attention: 3,
};

function overallStatus(
  integrations: readonly IntegrationHealth[],
): IntegrationStatus {
  return integrations.reduce<IntegrationStatus>(
    (current, integration) =>
      statusPriority[integration.status] > statusPriority[current]
        ? integration.status
        : current,
    "healthy",
  );
}

export function IntegrationStatusMenu({
  integrations,
}: {
  integrations: readonly IntegrationHealth[];
}) {
  const status = overallStatus(integrations);

  return (
    <details className={styles.integrationMenu}>
      <summary
        aria-label={`Integration status: ${status}`}
        className={styles.integrationSummary}
      >
        <CircleGauge aria-hidden="true" size={19} strokeWidth={1.8} />
        <span className={styles.integrationSummaryLabel}>Systems</span>
        <span
          aria-hidden="true"
          className={styles.statusDot}
          data-status={status}
        />
      </summary>
      <div className={styles.integrationPanel}>
        <p className={styles.integrationHeading}>Integration status</p>
        <ul className={styles.integrationList}>
          {integrations.map((integration) => (
            <li className={styles.integrationItem} key={integration.provider}>
              <span
                aria-hidden="true"
                className={styles.statusDot}
                data-status={integration.status}
              />
              <span className={styles.integrationProvider}>
                {providerLabels[integration.provider]}
              </span>
              <span className={styles.integrationMessage}>
                {integration.message}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
