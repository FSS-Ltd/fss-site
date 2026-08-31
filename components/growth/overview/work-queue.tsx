import { ArrowRight, ExternalLink } from "lucide-react";
import type { CSSProperties } from "react";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthEvidenceCount,
  formatGrowthRelativeDay,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import {
  WORK_QUEUE_PAGE_SIZE,
  WorkQueueKind,
  WorkQueueRow,
  WorkQueueTab,
} from "@/lib/growth/dashboard/overview";

import { GrowthNavigationLink } from "../shell/navigation-link";
import styles from "./overview.module.css";

type ScoreRingStyle = CSSProperties & Record<`--${string}`, string | number>;

const TAB_LABELS: Record<WorkQueueKind, string> = {
  first_emails: "First emails",
  replies: "Replies",
  follow_ups: "Follow-ups",
};

function statusMeta(
  kind: WorkQueueKind,
  row: WorkQueueRow,
  now: string,
): string {
  if (kind === "first_emails")
    return `Created ${formatGrowthDate(row.statusAt)}`;
  if (kind === "replies") return `Replied ${formatGrowthDate(row.statusAt)}`;
  return `Due ${formatGrowthRelativeDay(row.statusAt, now)}`;
}

function workQueueHref(kind: WorkQueueKind, page = 1): string {
  const searchParams = new URLSearchParams({ workQueue: kind });

  if (page > 1) {
    searchParams.set("workQueuePage", String(page));
  }

  return `/growth?${searchParams}`;
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
            <ExternalLink
              aria-hidden="true"
              size={11}
              style={{ marginLeft: 3 }}
            />
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
        <GrowthNavigationLink
          className={styles.rowReviewLink}
          href={row.reviewHref}
        >
          Review
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
        </GrowthNavigationLink>
      </td>
    </>
  );
}

function QueuePanel({
  currentPage,
  kind,
  now,
  tab,
}: {
  currentPage: number;
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
            <GrowthNavigationLink
              className={styles.rowReviewLink}
              href={row.reviewHref}
            >
              Review
            </GrowthNavigationLink>
          </li>
        ))}
      </ul>

      <QueuePagination
        currentPage={currentPage}
        kind={kind}
        totalCount={totalCount}
      />
    </>
  );
}

function QueuePagination({
  currentPage,
  kind,
  totalCount,
}: {
  currentPage: number;
  kind: WorkQueueKind;
  totalCount: number;
}) {
  const totalPages = Math.ceil(totalCount / WORK_QUEUE_PAGE_SIZE);

  if (totalPages <= 1) {
    return null;
  }

  const onFirstPage = currentPage === 1;
  const onLastPage = currentPage >= totalPages;

  return (
    <nav aria-label="Work queue pagination" className={styles.queuePagination}>
      <GrowthNavigationLink
        aria-disabled={onFirstPage}
        className={styles.queuePaginationLink}
        href={workQueueHref(kind, Math.max(1, currentPage - 1))}
        tabIndex={onFirstPage ? -1 : undefined}
      >
        Previous page
      </GrowthNavigationLink>
      <span aria-live="polite" className={styles.queuePageIndicator}>
        Page {currentPage} of {totalPages}
      </span>
      <GrowthNavigationLink
        aria-disabled={onLastPage}
        className={styles.queuePaginationLink}
        href={workQueueHref(kind, Math.min(totalPages, currentPage + 1))}
        tabIndex={onLastPage ? -1 : undefined}
      >
        Next page
      </GrowthNavigationLink>
    </nav>
  );
}

export function WorkQueue({
  activeTab,
  currentPage,
  now,
  tabs,
}: {
  activeTab: WorkQueueKind;
  currentPage: number;
  now: string;
  tabs: readonly WorkQueueTab[];
}) {
  const byKind = new Map(tabs.map((tab) => [tab.kind, tab]));
  const activeTabData = byKind.get(activeTab);
  const primaryReviewHref = activeTabData?.rows[0]?.reviewHref;

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
          <GrowthNavigationLink
            className={styles.reviewButton}
            href={primaryReviewHref}
          >
            Review next email
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
          </GrowthNavigationLink>
        )}
      </div>

      <nav aria-label="Work queue categories" className={styles.tabList}>
        {tabs.map((tab) => {
          const selected = tab.kind === activeTab;

          return (
            <GrowthNavigationLink
              aria-current={selected ? "page" : undefined}
              className={styles.tab}
              href={workQueueHref(tab.kind)}
              key={tab.kind}
            >
              {TAB_LABELS[tab.kind]} ({tab.totalCount})
            </GrowthNavigationLink>
          );
        })}
      </nav>

      <div className={styles.tabPanel}>
        <QueuePanel
          currentPage={currentPage}
          kind={activeTab}
          now={now}
          tab={activeTabData}
        />
      </div>
    </section>
  );
}
