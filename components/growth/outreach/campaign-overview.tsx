import Link from "next/link";
import type { CampaignOverviewResult } from "@/lib/growth/dashboard/campaign-overview";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import { CampaignLifecycleActions } from "./campaign-lifecycle-actions";
import styles from "./campaign-overview.module.css";

function campaignState(status: string, approved: boolean): string {
  if (status === "approved") return "Policy active";
  if (status === "revoked") return "Revoked";
  return approved ? "Approved, paused" : "Draft, paused";
}

export function CampaignOverview({
  result,
}: {
  result: CampaignOverviewResult;
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
        <Link href="/growth/prospects">Review prospects</Link>
      </header>
      <p className={styles.goal}>
        Daily goal 100 · target 150. Sending depends on eligible recipients and
        approved account capacity.
      </p>
      {result.rows.length === 0 ? (
        <p className={styles.empty}>No campaigns have been created yet.</p>
      ) : (
        <ul className={styles.list}>
          {result.rows.map((campaign) => (
            <li key={campaign.id} className={styles.campaign}>
              <div className={styles.title}>
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
              <dl className={styles.metrics}>
                <div>
                  <dt>Prepared today</dt>
                  <dd>{campaign.prepared}</dd>
                </div>
                <div>
                  <dt>Held jobs</dt>
                  <dd>{campaign.held}</dd>
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
              </dl>
              <div className={styles.footer}>
                <p>
                  {campaign.held
                    ? `Held reason: ${campaign.holdReason?.replaceAll("_", " ") ?? "Unavailable"}`
                    : "No held jobs"}
                </p>
                <p>
                  {campaign.reportDue
                    ? `Analysis ${campaign.reportStatus === "held" ? "held, originally due" : "due"} ${formatGrowthDateTime(campaign.reportDue)}`
                    : "No analysis date recorded"}
                </p>
              </div>
              <CampaignLifecycleActions
                id={campaign.id}
                version={campaign.version}
                status={campaign.status}
                approved={campaign.approved}
              />
            </li>
          ))}
        </ul>
      )}
      {result.truncated && (
        <p className={styles.empty}>Showing the first 50 campaigns.</p>
      )}
      <p className={styles.note}>
        Confirmation reflects the recorded provider observation. Account
        readiness and delivery are unavailable in this view.
      </p>
    </section>
  );
}
