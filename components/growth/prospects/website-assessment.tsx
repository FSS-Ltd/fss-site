import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  formatGrowthDate,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { ProspectDetailWebsiteAssessment } from "@/lib/growth/dashboard/prospect-detail";

import styles from "./prospects.module.css";

export function WebsiteAssessment({
  assessment,
  prospectId,
}: {
  assessment: ProspectDetailWebsiteAssessment | null;
  prospectId: string;
}) {
  if (!assessment) {
    return (
      <p className={styles.inlineEmpty}>No website assessment recorded yet.</p>
    );
  }

  return (
    <div>
      <p className={styles.contactField}>
        <strong>Goal:</strong> {assessment.businessGoal}
      </p>
      <p className={styles.contactField}>
        <strong>Primary call to action:</strong> {assessment.primaryCta}
      </p>
      <p className={styles.contactField}>
        <span className={styles.pill} data-tone="neutral">
          {formatGrowthStatusLabel(assessment.status)}
        </span>
        {assessment.reviewedAt && (
          <span>Reviewed {formatGrowthDate(assessment.reviewedAt)}</span>
        )}
      </p>
      <Link
        className={styles.evidenceLink}
        href={`/growth/prospects/${prospectId}/website-strategy`}
      >
        View full strategy
        <ArrowRight aria-hidden="true" size={12} strokeWidth={2.2} />
      </Link>
    </div>
  );
}
