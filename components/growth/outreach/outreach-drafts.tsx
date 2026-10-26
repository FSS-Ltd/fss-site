"use client";

import { useState } from "react";
import Link from "next/link";

import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import type { OutreachDraftsResult } from "@/lib/growth/dashboard/outreach-drafts";

import { DraftPagination } from "./draft-pagination";
import { SendAllDrafts } from "./send-all-drafts";

import styles from "./outreach.module.css";

export function OutreachDrafts({
  result,
}: {
  result: OutreachDraftsResult;
}): React.JSX.Element {
  const [requestedPage, setPage] = useState(1);
  const rows = result.status === "ready" ? result.rows : [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const page = Math.min(requestedPage, pageCount);
  const visibleRows = rows.slice((page - 1) * 10, page * 10);
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.sectionTitle}>Email drafts</h2>
        {result.status === "ready" && result.rows.length > 0 && (
          <SendAllDrafts rows={result.rows} />
        )}
      </div>
      {result.status === "error" ? (
        <div role="alert">
          <p>{result.message}</p>
          <p>Reference: {result.correlationId}</p>
        </div>
      ) : result.rows.length === 0 ? (
        <p className={styles.timelineMeta}>
          No email drafts are waiting for review.
        </p>
      ) : (
        <>
          <p className={styles.timelineMeta}>
            Review each draft and its evidence, then create a Gmail draft or
            approve and send it.
          </p>
          <p className={styles.timelineMeta}>
            Send all covers all {rows.length} drafts across pages.
          </p>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>
              Email drafts awaiting founder review
            </caption>
            <thead>
              <tr>
                <th scope="col">Business</th>
                <th scope="col">Contact</th>
                <th scope="col">Draft ready</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.draftTaskId}>
                  <td>{row.businessName}</td>
                  <td>{row.contactName}</td>
                  <td>{formatGrowthDateTime(row.completedAt)}</td>
                  <td>
                    <Link
                      className={styles.rowLink}
                      href={`/growth/outreach/messages/${row.draftTaskId}`}
                      prefetch={false}
                    >
                      Review &amp; publish
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className={styles.mobileList}>
            {visibleRows.map((row) => (
              <li className={styles.mobileCard} key={row.draftTaskId}>
                <div>
                  <p className={styles.timelineTitle}>{row.businessName}</p>
                  <p className={styles.timelineMeta}>{row.contactName}</p>
                </div>
                <Link
                  className={styles.rowLink}
                  href={`/growth/outreach/messages/${row.draftTaskId}`}
                  prefetch={false}
                >
                  Review &amp; publish
                </Link>
              </li>
            ))}
          </ul>
          <DraftPagination
            page={page}
            pageCount={pageCount}
            total={rows.length}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
