"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import Link from "next/link";

import {
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { NewsletterIssueReview as NewsletterIssueReviewData } from "@/lib/growth/dashboard/newsletter";

import { NewsletterActions } from "./newsletter-actions";
import styles from "./newsletter.module.css";

type PreviewMode = "html" | "text";

const UNSUBSCRIBE_URL_PLACEHOLDER = "{{unsubscribe_url}}";

export function IssueReview({ data }: { data: NewsletterIssueReviewData }) {
  const [mode, setMode] = useState<PreviewMode>("html");

  const hasUnsubscribeLink =
    data.htmlSnapshot.includes(UNSUBSCRIBE_URL_PLACEHOLDER) &&
    data.textSnapshot.includes(UNSUBSCRIBE_URL_PLACEHOLDER);

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/newsletter">Newsletter</Link> / Drafts /{" "}
        {data.issueKey}
      </p>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitles}>
            <h1 className={styles.heading}>Review newsletter</h1>
            <span className={styles.pill} data-tone="neutral">
              {formatGrowthStatusLabel(data.status)}
            </span>
          </div>
          <p className={styles.subtitle}>
            Check the full copy, imagery and audience before sending through
            Resend.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Newsletter draft</h2>

            <div className={styles.envelope}>
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>Subject</span>
                <span className={styles.envelopeValue}>{data.subject}</span>
              </div>
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>Preheader</span>
                <span className={styles.envelopeValue}>{data.previewText}</span>
              </div>
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>From</span>
                <span className={styles.envelopeValue}>
                  {data.fromEmail ?? "Not configured"}
                </span>
              </div>
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>Reply to</span>
                <span className={styles.envelopeValue}>
                  {data.replyToEmail ?? "Not configured"}
                </span>
              </div>
            </div>

            <div
              aria-label="Preview format"
              className={styles.previewToggle}
              role="group"
            >
              <button
                aria-pressed={mode === "html"}
                className={styles.previewToggleButton}
                onClick={() => setMode("html")}
                type="button"
              >
                HTML
              </button>
              <button
                aria-pressed={mode === "text"}
                className={styles.previewToggleButton}
                onClick={() => setMode("text")}
                type="button"
              >
                Plain text
              </button>
            </div>

            {mode === "html" ? (
              <div className={styles.previewFrame}>
                <iframe
                  sandbox=""
                  srcDoc={data.htmlSnapshot}
                  title="Newsletter HTML preview"
                />
              </div>
            ) : (
              <pre className={styles.previewPlainText}>{data.textSnapshot}</pre>
            )}
          </div>

          <NewsletterActions issue={data} />
        </div>

        <div className={styles.column}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Issue settings</h2>
            <ul className={styles.metaList}>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Audience</span>
                <span className={styles.metaValue}>
                  {data.audience.eligibleCount} eligible
                </span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Suppressed</span>
                <span className={styles.metaValue}>
                  {data.audience.suppressedCount}
                </span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Issue checksum</span>
                <span className={styles.metaValue}>
                  {data.checksum.slice(0, 12)}…
                </span>
              </li>
            </ul>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Content checks</h2>
            <ul className={styles.checklist}>
              <li className={styles.checklistItem}>
                <CircleCheck
                  aria-hidden="true"
                  className={styles.checklistIcon}
                  size={16}
                />
                <span>Plain-text version present</span>
              </li>
              {hasUnsubscribeLink && (
                <li className={styles.checklistItem}>
                  <CircleCheck
                    aria-hidden="true"
                    className={styles.checklistIcon}
                    size={16}
                  />
                  <span>Unsubscribe link present in both versions</span>
                </li>
              )}
              {data.asset && (
                <li className={styles.checklistItem}>
                  <CircleCheck
                    aria-hidden="true"
                    className={styles.checklistIcon}
                    size={16}
                  />
                  <span>Image alt text: {data.asset.altText}</span>
                </li>
              )}
            </ul>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Delivery</h2>
            <ul className={styles.metaList}>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Service</span>
                <span className={styles.metaValue}>Resend</span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Schedule</span>
                <span className={styles.metaValue}>
                  {data.scheduledFor
                    ? formatGrowthDateTime(data.scheduledFor)
                    : "Not yet scheduled"}
                </span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Previous test</span>
                <span className={styles.metaValue}>
                  {data.testSentAt
                    ? formatGrowthDateTime(data.testSentAt)
                    : "Not sent"}
                </span>
              </li>
            </ul>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Versions</h2>
            <ul className={styles.metaList}>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Version</span>
                <span className={styles.metaValue}>{data.version}</span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Created by</span>
                <span className={styles.metaValue}>{data.createdBy}</span>
              </li>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Last saved</span>
                <span className={styles.metaValue}>
                  {formatGrowthDateTime(data.updatedAt)}
                </span>
              </li>
              {data.approvedAt && (
                <li className={styles.metaItem}>
                  <span className={styles.metaLabel}>Approved</span>
                  <span className={styles.metaValue}>
                    {formatGrowthDateTime(data.approvedAt)} by {data.approvedBy}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
