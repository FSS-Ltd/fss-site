import { CircleCheck, TriangleAlert } from "lucide-react";

import {
  formatGrowthCurrency,
  formatGrowthDateTime,
  formatGrowthEvidenceCount,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";

import styles from "./outreach.module.css";

const MAX_VISIBLE_CITATIONS = 5;

function publisherFromUrl(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

export function ReviewEvidence({ message }: { message: MessageReviewData }) {
  const visibleCitations = message.citations.slice(0, MAX_VISIBLE_CITATIONS);

  return (
    <div className={styles.column}>
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Research used</h2>
        {visibleCitations.length === 0 ? (
          <p>No cited research is on file for this prospect.</p>
        ) : (
          <ul className={styles.checklist}>
            {visibleCitations.map((citation) => (
              <li className={styles.checklistItem} key={citation.id}>
                <CircleCheck
                  aria-hidden="true"
                  className={styles.checklistIcon}
                  size={16}
                />
                <span>
                  {citation.claimSummary} ({publisherFromUrl(citation.sourceUrl)})
                </span>
              </li>
            ))}
          </ul>
        )}
        <p>
          <a
            className={styles.evidenceLink}
            href={`/growth/prospects/${message.prospectId}`}
          >
            View all {formatGrowthEvidenceCount(message.citations.length)}
          </a>
        </p>
        <p className={styles.warningNote}>
          <TriangleAlert aria-hidden="true" size={14} style={{ flex: "none" }} />
          Verify every claim before sending.
        </p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Offer and fit</h2>
        <div className={styles.statRow}>
          <div>
            <p className={styles.statLabel}>Fit</p>
            <p className={styles.statValue}>{message.fitScore}/100</p>
          </div>
          <div>
            <p className={styles.statLabel}>Solution</p>
            <p className={styles.statValue}>{message.recommendedOffer}</p>
          </div>
          <div>
            <p className={styles.statLabel}>Investment range</p>
            <p className={styles.statValue}>
              {formatGrowthCurrency(message.estimatedOneOffMinPence)}–
              {formatGrowthCurrency(message.estimatedOneOffMaxPence)}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Sequence preview</h2>
        <ol className={styles.cadenceList}>
          {message.followUpCadence.map((step) => (
            <li className={styles.cadenceItem} key={step.day}>
              <span className={styles.cadenceDay}>{step.day}</span>
              <span className={styles.cadenceLabel}>{step.label}</span>
            </li>
          ))}
        </ol>
        <p className={styles.cadenceNote}>
          Stops automatically on reply, opt-out, bounce, or manual pause.
        </p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Visual checks</h2>
        <ul className={styles.checklist}>
          <li className={styles.checklistItem}>
            <CircleCheck
              aria-hidden="true"
              className={styles.checklistIcon}
              size={16}
            />
            <span>Alt text: {message.imageAltText}</span>
          </li>
          {message.imageByteSize !== null && (
            <li className={styles.checklistItem}>
              <CircleCheck
                aria-hidden="true"
                className={styles.checklistIcon}
                size={16}
              />
              <span>{Math.round(message.imageByteSize / 1024)} KB</span>
            </li>
          )}
          <li className={styles.checklistItem}>
            <span
              className={styles.pill}
              data-tone={
                message.visualReviewStatus === null ||
                message.visualReviewStatus === "approved"
                  ? undefined
                  : "amber"
              }
            >
              {message.visualReviewStatus === null
                ? "Fallback visual"
                : formatGrowthStatusLabel(message.visualReviewStatus)}
            </span>
          </li>
        </ul>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Draft status</h2>
        <p className={styles.checklistItem}>
          <CircleCheck
            aria-hidden="true"
            className={styles.checklistIcon}
            size={16}
          />
          <span>
            {message.revisionCount > 1
              ? `Revised by founder (v${message.version})`
              : "Ready for founder review"}
          </span>
        </p>
        <p className={styles.cadenceNote}>
          Created by scheduled Codex task, {formatGrowthDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
