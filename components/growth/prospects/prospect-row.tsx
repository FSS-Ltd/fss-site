import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  formatGrowthCurrency,
  formatGrowthStatusLabel,
  formatGrowthDate,
} from "@/lib/growth/dashboard/formatters";
import type { ProspectListRow } from "@/lib/growth/dashboard/prospects";

import styles from "./prospects.module.css";

type ScoreRingStyle = CSSProperties & Record<`--${string}`, string | number>;

const OUTREACH_LABELS: Record<ProspectListRow["outreachState"], string> = {
  not_started: "Not started",
  active: "Active",
  paused: "Paused",
  stopped: "Stopped",
  completed: "Completed",
};

const OUTREACH_TONE: Record<
  ProspectListRow["outreachState"],
  "teal" | "neutral" | "amber" | "red"
> = {
  not_started: "neutral",
  active: "teal",
  paused: "amber",
  stopped: "red",
  completed: "teal",
};

function ScoreRing({ score }: { score: number }) {
  return (
    <span
      className={styles.scoreRing}
      data-score={score}
      style={{ "--score": score } as ScoreRingStyle}
    />
  );
}

export function ProspectRow({ row }: { row: ProspectListRow }) {
  const detailHref = `/growth/prospects/${row.prospectId}`;

  return (
    <tr>
      <td>
        <Link className={styles.business} href={detailHref}>
          {row.businessName}
        </Link>
        {row.primaryContactName && (
          <p className={styles.nextStep}>{row.primaryContactName}</p>
        )}
        <p className={styles.nextStep}>
          {row.nextAction ?? "No next step"}
          {row.nextActionDueAt && ` · ${formatGrowthDate(row.nextActionDueAt)}`}
        </p>
        {row.websiteUrl && (
          <a
            className={styles.website}
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
      <td className={styles.sectorLocation}>
        {row.sector}, {row.location}
      </td>
      <td>
        <ScoreRing score={row.fitScore} />
      </td>
      <td className={styles.opportunity}>{row.opportunitySummary}</td>
      <td className={styles.opportunity}>{row.recommendedOffer}</td>
      <td>
        <span
          className={styles.pill}
          data-tone={OUTREACH_TONE[row.outreachState]}
        >
          {OUTREACH_LABELS[row.outreachState]}
        </span>
      </td>
      <td>
        <span className={styles.pill} data-tone="neutral">
          {formatGrowthStatusLabel(row.status)}
        </span>
      </td>
      <td>
        <span className={styles.value}>
          {row.researchOnly && row.potentialValuePence === 0
            ? "Not estimated"
            : formatGrowthCurrency(row.potentialValuePence)}
        </span>
      </td>
      <td>
        <Link className={styles.rowLink} href={detailHref}>
          View
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
        </Link>
      </td>
    </tr>
  );
}

export function ProspectMobileCard({ row }: { row: ProspectListRow }) {
  const detailHref = `/growth/prospects/${row.prospectId}`;

  return (
    <li className={styles.mobileCard}>
      <ScoreRing score={row.fitScore} />
      <div className={styles.mobileBody}>
        <Link className={styles.business} href={detailHref}>
          {row.businessName}
        </Link>
        {row.primaryContactName && (
          <p className={styles.nextStep}>{row.primaryContactName}</p>
        )}
        <p className={styles.nextStep}>
          {row.nextAction ?? "No next step"}
          {row.nextActionDueAt && ` · ${formatGrowthDate(row.nextActionDueAt)}`}
        </p>
        <p className={styles.sectorLocation}>
          {row.sector}, {row.location}
        </p>
      </div>
      <span className={styles.value}>
        {row.researchOnly && row.potentialValuePence === 0
          ? "Not estimated"
          : formatGrowthCurrency(row.potentialValuePence)}
      </span>
      <Link className={styles.rowLink} href={detailHref}>
        View
      </Link>
    </li>
  );
}
