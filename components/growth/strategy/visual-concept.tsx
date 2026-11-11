import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { VisualConceptData } from "@/lib/growth/dashboard/website-strategy";

import { SectionCard } from "./strategy-review";
import styles from "./strategy.module.css";

type ScoreRingStyle = CSSProperties & Record<`--${string}`, string | number>;

export function VisualConcept({ data }: { data: VisualConceptData }) {
  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/prospects">Prospects</Link> /{" "}
        <Link href={`/growth/prospects/${data.prospectId}`}>
          {data.businessName}
        </Link>{" "}
        / 3D Hero
      </p>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitles}>
            <h1 className={styles.heading}>3D hero concept</h1>
            <span className={styles.pill} data-tone="neutral">
              {formatGrowthStatusLabel(data.status)}
            </span>
          </div>
          <p className={styles.subtitle}>
            A single generated concept image for {data.businessName}&rsquo;s
            proposed homepage hero.
          </p>
          {data.reviewedAt && (
            <p className={styles.reviewedNote}>
              Reviewed {formatGrowthDate(data.reviewedAt)}
            </p>
          )}
        </div>
        <Link
          className={styles.evidenceLink}
          href={`/growth/prospects/${data.prospectId}/website-strategy`}
        >
          View website strategy
        </Link>
      </div>

      <div className={styles.card}>
        <div className={styles.summaryHeader}>
          <span
            className={styles.scoreRing}
            data-score={data.fitScore}
            style={{ "--score": data.fitScore } as ScoreRingStyle}
          />
          <div>
            <h2 className={styles.sectionTitle}>{data.businessName}</h2>
            <div className={styles.summaryMeta}>
              <span>{data.sector}</span>
              <span>{data.locality}</span>
            </div>
          </div>
        </div>
        <div className={styles.statRow}>
          <div>
            <p className={styles.statLabel}>Fit</p>
            <p className={styles.statValue}>{data.fitScore}/100</p>
          </div>
          <div>
            <p className={styles.statLabel}>Recommended offer</p>
            <p className={styles.statValue}>{data.recommendedOffer}</p>
          </div>
          <div>
            <p className={styles.statLabel}>Potential value</p>
            <p className={styles.statValue}>
              {formatGrowthCurrency(data.estimatedOneOffMinPence)}–
              {formatGrowthCurrency(data.estimatedOneOffMaxPence)}
            </p>
          </div>
        </div>
      </div>

      {data.asset === null ? (
        <div className={styles.card}>
          <p className={styles.emptyState}>
            No visual concept has been generated for this prospect yet.
          </p>
        </div>
      ) : (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Concept image</h2>
          <div className={styles.visualImageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={data.asset.altText}
              className={styles.visualImage}
              height={data.asset.height}
              src={data.asset.url}
              width={data.asset.width}
            />
          </div>
          <p className={styles.visualCaption}>{data.asset.altText}</p>

          <ul className={styles.metaList}>
            <li className={styles.metaItem}>
              <span className={styles.metaLabel}>Dimensions</span>
              <span className={styles.metaValue}>
                {data.asset.width}×{data.asset.height}px
              </span>
            </li>
            <li className={styles.metaItem}>
              <span className={styles.metaLabel}>File size</span>
              <span className={styles.metaValue}>
                {Math.round(data.asset.byteSize / 1024)} KB
              </span>
            </li>
            <li className={styles.metaItem}>
              <span className={styles.metaLabel}>Checksum (SHA-256)</span>
              <span className={styles.metaValue}>{data.asset.sha256}</span>
            </li>
            <li className={styles.metaItem}>
              <span className={styles.metaLabel}>Generated</span>
              <span className={styles.metaValue}>
                {formatGrowthDateTime(data.asset.createdAt)} by{" "}
                {data.asset.createdBy}
              </span>
            </li>
            <li className={styles.metaItem}>
              <span className={styles.metaLabel}>Validation status</span>
              <span className={styles.metaValue}>
                {formatGrowthStatusLabel(data.asset.reviewStatus)}
              </span>
            </li>
          </ul>

          <div className={styles.disclaimer}>
            <TriangleAlert aria-hidden="true" size={18} style={{ flex: "none" }} />
            <div>
              <strong>Generated concept, not a built product</strong>
              <p>
                This image is an AI-generated concept for discussion. No 3D
                renderer or working website was used to produce it.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={styles.sectionsGrid}>
        <SectionCard section={data.heroConcept} title="Hero concept" />
        <SectionCard section={data.mobileFallback} title="Mobile fallback" />
        <SectionCard
          section={data.performanceBudget}
          title="Performance budget"
        />
      </div>
    </div>
  );
}
