import {
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { SettingsData } from "@/lib/growth/dashboard/settings";

import styles from "./settings.module.css";

function gmailTone(
  status: SettingsData["gmail"]["status"],
): "neutral" | "amber" | "red" | undefined {
  if (status === "connected") return undefined;
  if (status === "degraded") return "amber";
  if (status === "error" || status === "revoked") return "red";
  return "neutral";
}

export function IntegrationHealth({ data }: { data: SettingsData }) {
  return (
    <>
      <p className={styles.subtitle}>
        Redacted integration health, checked {formatGrowthDateTime(data.checkedAt)}.
      </p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Database</h2>
            <span
              className={styles.pill}
              data-tone={data.databaseAvailable ? undefined : "red"}
            >
              {data.databaseAvailable ? "Available" : "Needs attention"}
            </span>
          </div>
          <p className={styles.guidance}>
            The private Growth OS Postgres schema this dashboard reads from.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Gmail</h2>
            <span className={styles.pill} data-tone={gmailTone(data.gmail.status)}>
              {formatGrowthStatusLabel(data.gmail.status)}
            </span>
          </div>

          {!data.gmail.configured ? (
            <p className={styles.guidance}>
              Not configured. Set GOOGLE_GMAIL_CLIENT_ID,
              GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI as
              Vercel environment variables to enable Gmail.
            </p>
          ) : (
            <ul className={styles.metaList}>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Account</span>
                <span className={styles.metaValue}>
                  {data.gmail.accountIdentity ?? "Not connected"}
                </span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Last successful sync</span>
                <span className={styles.metaValue}>
                  {data.gmail.lastSuccessAt
                    ? formatGrowthDateTime(data.gmail.lastSuccessAt)
                    : "Never"}
                </span>
              </li>
              {data.gmail.lastErrorCode && (
                <li className={styles.metaItem}>
                  <span className={styles.metaLabel}>Last error</span>
                  <span className={styles.metaValue}>
                    {formatGrowthStatusLabel(data.gmail.lastErrorCode)}
                  </span>
                </li>
              )}
            </ul>
          )}

          {data.gmail.grantedScopes.length > 0 && (
            <ul className={styles.scopeList}>
              {data.gmail.grantedScopes.map((scope) => (
                <li className={styles.scopeChip} key={scope}>
                  {scope}
                </li>
              ))}
            </ul>
          )}

          {data.gmail.configured && (
            <div className={styles.actionsBar}>
              {data.gmail.accountIdentity ? (
                <form action="/api/integrations/gmail/disconnect" method="post">
                  <button className={styles.actionButton} data-variant="danger" type="submit">
                    Disconnect Gmail
                  </button>
                </form>
              ) : (
                <a className={styles.actionButton} href="/api/integrations/gmail/connect">
                  Connect Gmail
                </a>
              )}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Resend</h2>
            <span
              className={styles.pill}
              data-tone={data.resend.configured ? undefined : "neutral"}
            >
              {data.resend.configured ? "Configured" : "Not configured"}
            </span>
          </div>
          {data.resend.configured ? (
            <ul className={styles.metaList}>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>From</span>
                <span className={styles.metaValue}>{data.resend.fromEmail}</span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Reply to</span>
                <span className={styles.metaValue}>{data.resend.replyToEmail}</span>
              </li>
            </ul>
          ) : (
            <p className={styles.guidance}>
              Not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and
              RESEND_REPLY_TO_EMAIL as Vercel environment variables to enable
              newsletter and site-email sending.
            </p>
          )}
          <p className={styles.guidance}>
            Resend is configured externally — this dashboard cannot change
            these values.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Vercel Blob</h2>
            <span
              className={styles.pill}
              data-tone={data.vercelBlobConfigured ? undefined : "neutral"}
            >
              {data.vercelBlobConfigured ? "Configured" : "Not configured"}
            </span>
          </div>
          <p className={styles.guidance}>
            Stores generated email visuals. Attached to the Vercel project
            automatically — this dashboard cannot change it.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Codex</h2>
            <span
              className={styles.pill}
              data-tone={data.codexConfigured ? undefined : "neutral"}
            >
              {data.codexConfigured ? "Configured" : "Not configured"}
            </span>
          </div>
          <p className={styles.guidance}>
            {data.codexConfigured
              ? "Signed research ingestion is configured. The external weekday task is managed in Codex."
              : "Signed research ingestion is not configured in this deployment."}
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Scheduled automation</h2>
            <span
              className={styles.pill}
              data-tone={data.automation.automationsEnabled ? undefined : "neutral"}
            >
              {data.automation.automationsEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <ul className={styles.metaList}>
            {data.automation.crons.map((cron) => (
              <li className={styles.metaItem} key={cron.path}>
                <span className={styles.metaLabel}>{cron.label}</span>
                <span className={styles.metaValue}>
                  {cron.scheduleDescription}
                  {cron.nextRunAt &&
                    ` · Next ${formatGrowthDateTime(cron.nextRunAt)}`}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.guidance}>
            Controlled by the GROWTH_OS_AUTOMATIONS_ENABLED Vercel
            environment variable — this dashboard cannot change it.
          </p>
        </div>
      </div>
    </>
  );
}
