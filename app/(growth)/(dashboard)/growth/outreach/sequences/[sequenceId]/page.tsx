import { ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SequenceControls } from "@/components/growth/outreach/sequence-controls";
import { SequenceTimeline } from "@/components/growth/outreach/sequence-timeline";
import styles from "@/components/growth/outreach/outreach.module.css";
import {
  formatGrowthCurrency,
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import { getOutreachDetail } from "@/lib/growth/dashboard/outreach";

type SequenceDetailPageProps = {
  params: Promise<{ sequenceId: string }>;
};

export default async function SequenceDetailPage({
  params,
}: SequenceDetailPageProps) {
  const { sequenceId } = await params;
  const result = await getOutreachDetail(sequenceId);

  if (result.status === "not_found") {
    notFound();
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

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/outreach">Outreach</Link> /{" "}
        <Link href="/growth/outreach">Active sequences</Link> / {data.businessName}
      </p>

      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Outreach timeline</h1>
          <p className={styles.subtitle}>
            One Gmail thread, with every automated step stopped by a reply or
            founder action.
          </p>
        </div>
        {data.gmailThreadUrl && (
          <a
            className={styles.rowLink}
            href={data.gmailThreadUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Open in Gmail
            <ExternalLink aria-hidden="true" size={13} />
          </a>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.statRow}>
          <div>
            <p className={styles.statLabel}>Business</p>
            <p className={styles.statValue}>{data.businessName}</p>
          </div>
          <div>
            <p className={styles.statLabel}>Contact</p>
            <p className={styles.statValue}>{data.contactName}</p>
          </div>
          <div>
            <p className={styles.statLabel}>Status</p>
            <span className={styles.pill}>{formatGrowthStatusLabel(data.status)}</span>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Sequence activity</h2>
            <SequenceTimeline timeline={data.timeline} />
          </div>

          <div className={styles.rulesBox}>
            <ShieldCheck aria-hidden="true" size={20} style={{ flex: "none" }} />
            <div>
              <strong>Sequence rules</strong>
              <p>
                Replies, opt-outs, bounces and manual pauses stop all
                remaining emails.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.column}>
          <SequenceControls detail={data} />

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Thread health</h2>
            <ul className={styles.checklist}>
              <li className={styles.checklistItem}>
                <span>Delivered: {data.threadHealth.deliveredCount}</span>
              </li>
              <li className={styles.checklistItem}>
                <span>Replied: {data.threadHealth.repliedCount}</span>
              </li>
              <li className={styles.checklistItem}>
                <span>
                  Last Gmail sync:{" "}
                  {data.threadHealth.lastGmailSyncAt
                    ? formatGrowthDateTime(data.threadHealth.lastGmailSyncAt)
                    : "Not yet synced"}
                </span>
              </li>
            </ul>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Contact and offer</h2>
            <div className={styles.statRow}>
              <div>
                <p className={styles.statLabel}>Fit</p>
                <p className={styles.statValue}>{data.fitScore}/100</p>
              </div>
              <div>
                <p className={styles.statLabel}>Solution</p>
                <p className={styles.statValue}>{data.recommendedOffer}</p>
              </div>
              <div>
                <p className={styles.statLabel}>Investment range</p>
                <p className={styles.statValue}>
                  {formatGrowthCurrency(data.estimatedOneOffMinPence)}–
                  {formatGrowthCurrency(data.estimatedOneOffMaxPence)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
