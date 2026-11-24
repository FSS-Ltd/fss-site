import Link from "next/link";
import type {
  CampaignReportsResult,
  ReportSnapshot,
} from "@/lib/growth/dashboard/campaign-reports";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import styles from "./campaign-report.module.css";

function basis(value: string): string {
  return value === "gmail_fss_sent_observed"
    ? "Gmail SENT confirmation observed by FSS"
    : "Resend delivery confirmation observed by FSS";
}
function verdict(reason: string): string {
  if (reason === "clear_interval")
    return "A leading variant was recorded in this observed comparison.";
  if (reason === "insufficient_evidence")
    return "No winner: insufficient evidence.";
  if (reason === "confounded") return "No comparison: conditions differ.";
  return "No winner: comparison evidence is unknown.";
}
function Snapshot({ item }: { item: ReportSnapshot }) {
  if (item.status === "unavailable")
    return <p>Revision {item.revision}: snapshot unavailable or invalid.</p>;
  const report = item.report;
  return (
    <details className={styles.snapshot} open={item.current}>
      <summary>
        {item.current ? "Current" : "Superseded"} snapshot · anchor revision{" "}
        {item.revision}
      </summary>
      <div className={styles.snapshotBody}>
        <div className={styles.verdict}>
          <span>Comparison result</span>
          <p>
            {verdict(report.winnerReason)}{" "}
            {report.winner && `Recorded leading variant: ${report.winner}.`}
          </p>
        </div>
        <p className={styles.coverage}>
          Complete reply coverage observed at read: {item.observedCoverage} ·
          Ambiguous evidence: {report.ambiguousEvidence}. Outcome source
          coverage is unknown.
        </p>
        {report.groups.length === 0 ? (
          <p>No eligible comparison groups recorded.</p>
        ) : (
          <ul className={styles.arms}>
            {report.groups.map((group, index) => (
              <li
                key={`${group.policyVersion}:${group.variantId}:${group.variantVersion}:${index}`}
              >
                <h4>
                  {group.variantId} · version {group.variantVersion}
                </h4>
                <p className={styles.cta}>{group.cta}</p>
                <dl className={styles.numbers}>
                  <div>
                    <dt>Mature sample</dt>
                    <dd>{group.mature}</dd>
                  </div>
                  <div>
                    <dt>Positive replies (mature)</dt>
                    <dd>{group.positiveReplies}</dd>
                  </div>
                  <div>
                    <dt>Reply rate</dt>
                    <dd>
                      {group.positiveReplyRate === null
                        ? "Unknown"
                        : `${(group.positiveReplyRate * 100).toFixed(1)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>95% interval</dt>
                    <dd>
                      {group.interval === null
                        ? "Unknown"
                        : `${(group.interval[0] * 100).toFixed(1)}–${(group.interval[1] * 100).toFixed(1)}%`}
                    </dd>
                  </div>
                </dl>
                {group.positiveReplyRate !== null && (
                  <div aria-hidden="true">
                    <div className={styles.rateTrack}>
                      <span
                        style={{ width: `${group.positiveReplyRate * 100}%` }}
                      />
                    </div>
                    <div className={styles.scale}>
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
                <details className={styles.evidence}>
                  <summary>Variant evidence and coverage</summary>
                  <p>
                    {group.market} · {group.offer.replaceAll("_", " ")} · policy{" "}
                    {group.policyVersion} · {basis(group.basis)}
                  </p>
                  <dl className={styles.numbers}>
                    <div>
                      <dt>Known positive replies</dt>
                      <dd>{group.knownPositiveReplies}</dd>
                    </div>
                    <div>
                      <dt>Censored</dt>
                      <dd>{group.censored}</dd>
                    </div>
                    <div>
                      <dt>Later</dt>
                      <dd>{group.later}</dd>
                    </div>
                    <div>
                      <dt>Missing replies</dt>
                      <dd>{group.missingReplies}</dd>
                    </div>
                    <div>
                      <dt>Observed reviewed meetings</dt>
                      <dd>{group.qualifiedMeetings}</dd>
                    </div>
                    <div>
                      <dt>Observed reviewed payments</dt>
                      <dd>{group.paidConversions}</dd>
                    </div>
                  </dl>
                  <p>
                    Meeting coverage: {group.meetingMature} complete,{" "}
                    {group.meetingUnknown} unknown, {group.meetingCensored}{" "}
                    censored. Payment coverage: {group.paymentMature} complete,{" "}
                    {group.paymentUnknown} unknown, {group.paymentCensored}{" "}
                    censored.
                  </p>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className={styles.methodology}>
          <summary>Snapshot provenance and methodology</summary>
          <p>
            Generated {formatGrowthDateTime(item.generatedAt)} · cutoff{" "}
            {formatGrowthDateTime(report.cutoff.toISOString())}
          </p>
          <p>
            Anchor: {basis(report.anchor.basis)} ·{" "}
            {formatGrowthDateTime(report.anchor.observedAt.toISOString())}
          </p>
          {item.version === 1 ? (
            <p>
              Evidence available at cutoff: unknown. Complete reply coverage
              observed at report read: {item.observedCoverage}. Outcome source
              coverage and comparable copy identity: unknown. Ambiguous
              evidence: {report.ambiguousEvidence}.
            </p>
          ) : (
            <p>
              PostgreSQL statement snapshot read{" "}
              {item.readAt
                ? formatGrowthDateTime(item.readAt)
                : "at an unknown time"}
              . Reply events are limited to the cutoff; classifications and
              coverage reflect what was visible at that read. Historical source
              availability at cutoff and outcome source coverage are unknown.
              Complete reply coverage observed at read: {item.observedCoverage}.
              Copy identity is compared only where frozen evidence exists.
              Ambiguous evidence: {report.ambiguousEvidence}.
            </p>
          )}
          <p>
            The cohort spans 14 London calendar dates; each recipient needs a
            14-day observation period. Offer terms are unavailable in this
            snapshot.
          </p>
        </details>
      </div>
    </details>
  );
}
export function CampaignReports({ result }: { result: CampaignReportsResult }) {
  return (
    <section
      className={styles.panel}
      aria-labelledby="campaign-analysis-heading"
    >
      <header className={styles.header}>
        <div>
          <h2 id="campaign-analysis-heading">Campaign analysis</h2>
          <p>
            Immutable monthly snapshots, independent of the month filter above.
          </p>
        </div>
        <Link href="/growth/outreach">Review campaigns</Link>
      </header>
      {result.status === "unavailable" ? (
        <p role="alert">
          Campaign analysis is unavailable. Refresh to try again.
        </p>
      ) : result.campaigns.length === 0 ? (
        <p>No campaigns have a report anchor recorded.</p>
      ) : (
        <ul className={styles.campaigns}>
          {result.campaigns.map((campaign) => (
            <li key={campaign.id}>
              <h3>{campaign.name}</h3>
              {campaign.job.status === "no_anchor" ? (
                <p>No report anchor recorded.</p>
              ) : campaign.job.status === "unavailable" ? (
                <p>Report schedule unavailable.</p>
              ) : (
                <p>
                  {campaign.job.status === "held"
                    ? "Held"
                    : campaign.job.status === "completed"
                      ? "Snapshot generated"
                      : "Scheduled"}{" "}
                  · due {formatGrowthDateTime(campaign.job.dueAt)}
                  {campaign.job.status === "held" && campaign.job.reason
                    ? ` · ${campaign.job.reason.replaceAll("_", " ")}`
                    : ""}
                </p>
              )}
              {campaign.snapshots.map((item) => (
                <Snapshot key={item.revision} item={item} />
              ))}
              {campaign.truncated && (
                <p>Showing the three most recent snapshots.</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {result.status === "ready" && result.truncated && (
        <p>Showing the first 50 campaigns.</p>
      )}
    </section>
  );
}
