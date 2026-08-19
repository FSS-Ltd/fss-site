import { ExternalLink } from "lucide-react";

import {
  formatGrowthDate,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { ProspectEvidenceItem } from "@/lib/growth/dashboard/prospect-detail";

import styles from "./prospects.module.css";

function publisherFromUrl(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

export function EvidenceList({
  evidence,
}: {
  evidence: readonly ProspectEvidenceItem[];
}) {
  if (evidence.length === 0) {
    return <p className={styles.inlineEmpty}>No research evidence recorded yet.</p>;
  }

  return (
    <ul className={styles.evidenceList}>
      {evidence.map((item) => (
        <li className={styles.evidenceItem} key={item.id}>
          <div>
            <span className={styles.evidenceSource}>
              {formatGrowthStatusLabel(item.sourceType)}
            </span>
            <span className={styles.evidenceClaim}>
              {publisherFromUrl(item.sourceUrl)} · Captured{" "}
              {formatGrowthDate(item.observedAt)} · Verified{" "}
              {formatGrowthDate(item.verifiedAt)}
            </span>
            <span className={styles.evidenceClaim}>{item.claimSummary}</span>
          </div>
          <a
            className={styles.evidenceLink}
            href={item.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            View source
            <ExternalLink aria-hidden="true" size={12} strokeWidth={2.2} />
          </a>
        </li>
      ))}
    </ul>
  );
}
