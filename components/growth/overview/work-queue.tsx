"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useId, useState } from "react";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthEvidenceCount,
  formatGrowthRelativeDay,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type {
  WorkQueueKind,
  WorkQueueRow,
  WorkQueueTab,
} from "@/lib/growth/dashboard/overview";

import styles from "./overview.module.css";

type ScoreRingStyle = CSSProperties & Record<`--${string}`, string | number>;

const TAB_LABELS: Record<WorkQueueKind, string> = {
  first_emails: "First emails",
  replies: "Replies",
  follow_ups: "Follow-ups",
};

const VIEW_ALL_HREF: Record<WorkQueueKind, string> = {
  first_emails: "/growth/prospects?status=ready_for_email_review",
  replies: "/growth/prospects?status=replied",
  follow_ups: "/growth/outreach",
};

function statusMeta(kind: WorkQueueKind, row: WorkQueueRow, now: string): string {
  if (kind === "first_emails") return `Created ${formatGrowthDate(row.statusAt)}`;
  if (kind === "replies") return `Replied ${formatGrowthDate(row.statusAt)}`;
  return `Due ${formatGrowthRelativeDay(row.statusAt, now)}`;
}

function QueueRow({
  kind,
  now,
  row,
}: {
  kind: WorkQueueKind;
  now: string;
  row: WorkQueueRow;
}) {
  return (
    <>
      <td>
        <span className={styles.queueBusiness}>{row.businessName}</span>
        {row.websiteUrl && (
          <a
            className={styles.queueWebsite}
            href={row.websiteUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {row.websiteUrl.replace(/^https?:\/\//, "")}
            <ExternalLink aria-hidden="true" size={11} style={{ marginLeft: 3 }} />
          </a>
        )}
      </td>
      <td>
        <span
          className={styles.scoreRing}
          data-score={row.fitScore}
          style={{ "--score": row.fitScore } as ScoreRingStyle}
        />
      </td>
      <td>{row.offerFocus}</td>
      <td>
        <span className={styles.statusPill} data-overdue={row.overdue}>
          {row.overdue ? "Overdue" : formatGrowthStatusLabel(row.status)}
        </span>
        <span className={styles.statusMeta}>{statusMeta(kind, row, now)}</span>
      </td>
      <td>{formatGrowthEvidenceCount(row.evidenceCount)}</td>
      <td>
        <span className={styles.queueValue}>
          {formatGrowthCurrency(row.potentialValuePence)}
        </span>
        <span className={styles.queueValueUnit}>One-off</span>
      </td>
      <td>
        <Link className={styles.rowReviewLink} href={row.reviewHref}>
          Review
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
        </Link>
      </td>
    </>
  );
}

function QueuePanel({
  kind,
  now,
  tab,
}: {
  kind: WorkQueueKind;
  now: string;
  tab: WorkQueueTab | undefined;
}) {
  const rows = tab?.rows ?? [];
  const totalCount = tab?.totalCount ?? 0;

  if (rows.length === 0) {
    return (
      <p className={styles.queueEmpty}>
        No {TAB_LABELS[kind].toLowerCase()} waiting for review.
      </p>
    );
  }

  return (
    <>
      <table className={styles.queueTable}>
        <caption className={styles.visuallyHidden}>
          {TAB_LABELS[kind]} work queue
        </caption>
        <thead>
          <tr>
            <th scope="col">Prospect</th>
            <th scope="col">Fit score</th>
            <th scope="col">Offer / focus</th>
            <th scope="col">Status</th>
            <th scope="col">Evidence</th>
            <th scope="col">Potential value</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.prospectId}>
              <QueueRow kind={kind} now={now} row={row} />
            </tr>
          ))}
        </tbody>
      </table>

      <ul className={styles.queueMobileList}>
        {rows.map((row) => (
          <li className={styles.queueMobileCard} key={row.prospectId}>
            <span
              className={styles.scoreRing}
              data-score={row.fitScore}
              style={{ "--score": row.fitScore } as ScoreRingStyle}
            />
            <div className={styles.queueMobileBody}>
              <p className={styles.queueBusiness}>{row.businessName}</p>
              <p className={styles.statusMeta}>{row.offerFocus}</p>
            </div>
            <span className={styles.queueValue}>
              {formatGrowthCurrency(row.potentialValuePence)}
            </span>
            <Link className={styles.rowReviewLink} href={row.reviewHref}>
              Review
            </Link>
          </li>
        ))}
      </ul>

      {totalCount > rows.length && (
        <Link className={styles.viewAllLink} href={VIEW_ALL_HREF[kind]}>
          View all {totalCount} {TAB_LABELS[kind].toLowerCase()}
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
        </Link>
      )}
    </>
  );
}

export function WorkQueue({
  defaultTab,
  now,
  tabs,
}: {
  defaultTab: WorkQueueKind;
  now: string;
  tabs: readonly WorkQueueTab[];
}) {
  const [activeTab, setActiveTab] = useState<WorkQueueKind>(defaultTab);
  const baseId = useId();
  const byKind = new Map(tabs.map((tab) => [tab.kind, tab]));
  const defaultTabData = byKind.get(defaultTab);
  const primaryReviewHref = defaultTabData?.rows[0]?.reviewHref;

  return (
    <section aria-labelledby="work-queue-heading" className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="work-queue-heading">
            Work queue
          </h2>
          <p className={styles.cardDescription}>
            Review and approve first emails, replies, and next actions.
          </p>
        </div>
        {primaryReviewHref && (
          <Link className={styles.reviewButton} href={primaryReviewHref}>
            Review next email
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
          </Link>
        )}
      </div>

      <div aria-label="Work queue categories" className={styles.tabList} role="tablist">
        {tabs.map((tab) => {
          const tabId = `${baseId}-tab-${tab.kind}`;
          const panelId = `${baseId}-panel-${tab.kind}`;
          const selected = tab.kind === activeTab;

          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className={styles.tab}
              id={tabId}
              key={tab.kind}
              onClick={() => setActiveTab(tab.kind)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {TAB_LABELS[tab.kind]} ({tab.totalCount})
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const tabId = `${baseId}-tab-${tab.kind}`;
        const panelId = `${baseId}-panel-${tab.kind}`;
        const selected = tab.kind === activeTab;

        return (
          <div
            aria-labelledby={tabId}
            className={styles.tabPanel}
            hidden={!selected}
            id={panelId}
            key={tab.kind}
            role="tabpanel"
          >
            <QueuePanel kind={tab.kind} now={now} tab={tab} />
          </div>
        );
      })}
    </section>
  );
}
