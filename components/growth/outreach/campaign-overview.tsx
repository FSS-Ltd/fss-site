import Link from "next/link";
import { CampaignDailyLive } from "./campaign-daily-live";
import type { CampaignDailySummaryResult } from "@/lib/growth/dashboard/campaign-daily-summary";
import type { CampaignAccountsResult } from "@/lib/growth/dashboard/campaign-accounts";
import { CampaignAccountReadiness } from "./campaign-account-readiness";
import type { CampaignOverviewResult } from "@/lib/growth/dashboard/campaign-overview";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import { CampaignPolicyEditor } from "./campaign-policy-editor";
import { CampaignLifecycleActions } from "./campaign-lifecycle-actions";
import styles from "./campaign-overview.module.css";

function campaignState(status: string, approved: boolean): string {
  if (status === "approved") return "Policy active";
  if (status === "revoked") return "Revoked";
  return approved ? "Approved, paused" : "Draft, paused";
}

export function CampaignOverview({
  result,
  accounts = { status: "unavailable" },
  dailySummary = { status: "unavailable" },
}: {
  result: CampaignOverviewResult;
  accounts?: CampaignAccountsResult;
  dailySummary?: CampaignDailySummaryResult;
}): React.JSX.Element {
  if (result.status === "error")
    return (
      <section className={styles.panel} aria-labelledby="campaigns-heading">
        <h2 id="campaigns-heading">Campaigns</h2>
        <div role="alert">
          <p>Campaigns could not load. Refresh the page to try again.</p>
          <p>Reference {result.reference}</p>
        </div>
      </section>
    );
  return (
    <section className={styles.panel} aria-labelledby="campaigns-heading">
      <header className={styles.header}>
        <div>
          <h2 id="campaigns-heading">Campaigns</h2>
          <p>{result.londonDate} · Europe/London</p>
        </div>
        <div>
          <Link href="/growth/prospects">Review prospects</Link>
          {" · "}
          <Link href="/growth/analytics#campaign-analysis-heading">
            Campaign analysis
          </Link>
        </div>
      </header>
      <div className={styles.operatorControls}>
        <CampaignPolicyEditor accounts={accounts} />
        <a href="#daily-summary-heading">Daily summary</a>
      </div>
      {result.rows.length === 0 ? (
        <p className={styles.empty}>No campaigns have been created yet.</p>
      ) : (
        <ul className={styles.list}>
          {result.rows.map((campaign) => (
            <li key={campaign.id} className={styles.campaign}>
              <div className={styles.title}>
                <div className={styles.identity}>
                  <div>
                    <h3>{campaign.name}</h3>
                    <p>
                      {campaign.offer} · Version {campaign.version}
                    </p>
                  </div>
                  <span className={styles.state}>
                    {campaignState(campaign.status, campaign.approved)}
                  </span>
                </div>
                <CampaignLifecycleActions
                  id={campaign.id}
                  version={campaign.version}
                  status={campaign.status}
                  approved={campaign.approved}
                />
              </div>
              <div className={styles.campaignControls}>
                <p className={styles.holdReason}>
                  {campaign.held
                    ? `Held reason: ${campaign.holdReason?.replaceAll("_", " ") ?? "Unavailable"}`
                    : "No held jobs"}
                </p>
                <CampaignPolicyEditor campaign={campaign} accounts={accounts} />
              </div>
              {campaign.prepared ||
              campaign.held ||
              campaign.attempts ||
              campaign.accepted ||
              campaign.confirmed ? (
                <dl
                  className={styles.stages}
                  aria-label="Today's campaign activity"
                >
                  <div>
                    <dt>Prepared today</dt>
                    <dd>{campaign.prepared}</dd>
                  </div>
                  <div>
                    <dt>Issued attempts today</dt>
                    <dd>{campaign.attempts}</dd>
                  </div>
                  <div>
                    <dt>Accepted today</dt>
                    <dd>{campaign.accepted}</dd>
                  </div>
                  <div>
                    <dt>Confirmed today</dt>
                    <dd>{campaign.confirmed}</dd>
                  </div>
                  <div>
                    <dt>Held jobs</dt>
                    <dd>{campaign.held}</dd>
                  </div>
                </dl>
              ) : (
                <details className={styles.inactive}>
                  <summary>No activity recorded today</summary>
                  <p>
                    Prepared today: 0 · Held jobs: 0 · Issued attempts today: 0
                    · Accepted today: 0 · Confirmed today: 0
                  </p>
                </details>
              )}
              <p className={styles.reportDate}>
                {campaign.reportDue
                  ? `Analysis ${campaign.reportStatus === "held" ? "held, originally due" : "due"} ${formatGrowthDateTime(campaign.reportDue)}`
                  : "No analysis date recorded"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {result.truncated && (
        <p className={styles.empty}>Showing the first 50 campaigns.</p>
      )}
      <div className={styles.operations}>
        <CampaignDailyLive
          key={
            dailySummary.status === "ready"
              ? dailySummary.summary.generatedAt
              : dailySummary.status
          }
          initial={dailySummary}
        />
        <CampaignAccountReadiness result={accounts} />
      </div>
      <p className={styles.note}>
        Confirmation reflects the recorded provider observation. Account
        readiness and delivery are unavailable in this view.
      </p>
    </section>
  );
}
