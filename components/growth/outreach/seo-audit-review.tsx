import Link from "next/link";

import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import type { SeoAuditReviewResult } from "@/lib/growth/dashboard/seo-audits";

import { SeoAuditActions } from "./seo-audit-actions";
import styles from "./outreach.module.css";

export function SeoAuditReview({ result }: { result: SeoAuditReviewResult }) {
  if (result.status === "not_found") {
    return (
      <div className={styles.card}>This SEO audit draft was not found.</div>
    );
  }
  if (result.status === "invalid") {
    return (
      <div className={styles.card} role="alert">
        This SEO audit draft is incomplete and cannot be reviewed.
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <div className={styles.card} role="alert">
        <p>{result.message}</p>
        <p>Reference: {result.correlationId}</p>
      </div>
    );
  }

  const { data } = result;
  const scores = [
    ["Technical SEO", data.audit.scores.technicalSeo],
    ["On-page SEO", data.audit.scores.onPageSeo],
    ["Local SEO", data.audit.scores.localSeo],
    ["AEO", data.audit.scores.answerEngineReadiness],
  ] as const;

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/outreach">Outreach</Link> / {data.businessName}
      </p>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Review SEO and AEO audit</h1>
          <p className={styles.subtitle}>
            A tailored Day 11 follow-up for {data.businessName}, generated after
            the Day 5 follow-up.
          </p>
        </div>
        <a
          className={styles.rowLink}
          href={data.reportUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open PDF
        </a>
      </header>

      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Email draft</h2>
            <div className={styles.envelope}>
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>To</span>
                <span className={styles.envelopeValue}>
                  {data.contactName} · {data.contactEmail}
                </span>
              </div>
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>Subject</span>
                <span className={styles.envelopeValue}>
                  {data.email.subject}
                </span>
              </div>
            </div>
            <div className={styles.previewFrame}>
              <iframe
                sandbox=""
                srcDoc={data.email.html}
                title="SEO audit email preview"
              />
            </div>
            <p className={styles.previewMeta}>
              <span>{data.email.wordCount} words</span>
              <span>PDF link included</span>
              <span>Plain-text fallback ready</span>
              <span>Approval required</span>
            </p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Audit summary</h2>
            <div className={styles.statRow}>
              {scores.map(([label, score]) => (
                <div key={label}>
                  <p className={styles.statLabel}>{label}</p>
                  <p className={styles.statValue}>{score}/100</p>
                </div>
              ))}
            </div>
            <p className={styles.auditSummary}>{data.audit.executiveSummary}</p>
            <h3 className={styles.auditSubheading}>Priority actions</h3>
            <ol className={styles.auditFindings}>
              {data.audit.findings.map((finding) => (
                <li className={styles.auditFinding} key={finding.id}>
                  <div className={styles.auditFindingHeader}>
                    <strong>{finding.title}</strong>
                    <span
                      className={styles.pill}
                      data-tone={
                        finding.severity === "critical" ||
                        finding.severity === "high"
                          ? "red"
                          : "amber"
                      }
                    >
                      {finding.severity}
                    </span>
                  </div>
                  <p>{finding.evidence}</p>
                  <p>{finding.whyItMatters}</p>
                  <ul className={styles.auditActionList}>
                    {finding.actions.map((action) => (
                      <li key={action.title}>
                        <strong>{action.title}:</strong> {action.instructions}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className={styles.column}>
          <SeoAuditActions data={data} />
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Delivery details</h2>
            <dl className={styles.auditDetails}>
              <div>
                <dt>Website</dt>
                <dd>{data.websiteUrl}</dd>
              </div>
              <div>
                <dt>Audit ready</dt>
                <dd>{formatGrowthDateTime(data.completedAt)}</dd>
              </div>
              <div>
                <dt>Queued for</dt>
                <dd>{formatGrowthDateTime(data.scheduledFor)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
