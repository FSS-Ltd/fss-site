import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type {
  AssessmentSection,
  WebsiteStrategyData,
} from "@/lib/growth/dashboard/website-strategy";

import styles from "./strategy.module.css";

type ScoreRingStyle = CSSProperties & Record<`--${string}`, string | number>;

export function SectionCard({
  section,
  title,
}: {
  section: AssessmentSection;
  title: string;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <p className={styles.sectionSummary}>{section.summary}</p>
      <ul className={styles.sectionItems}>
        {section.items.map((item, index) => (
          <li className={styles.sectionItem} key={index}>
            <CircleCheck
              aria-hidden="true"
              className={styles.sectionItemIcon}
              size={14}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StrategyReview({ data }: { data: WebsiteStrategyData }) {
  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/prospects">Prospects</Link> /{" "}
        <Link href={`/growth/prospects/${data.prospectId}`}>
          {data.businessName}
        </Link>{" "}
        / Website Brief
      </p>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitles}>
            <h1 className={styles.heading}>Website strategy</h1>
            <span className={styles.pill} data-tone="neutral">
              {formatGrowthStatusLabel(data.status)}
            </span>
          </div>
          <p className={styles.subtitle}>
            An agent-drafted brief for {data.businessName}, ready for founder
            review before it is shared.
          </p>
          {data.reviewedAt && (
            <p className={styles.reviewedNote}>
              Reviewed {formatGrowthDate(data.reviewedAt)}
            </p>
          )}
        </div>
        <Link className={styles.evidenceLink} href={`/growth/prospects/${data.prospectId}/visual`}>
          View 3D hero concept
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

      <div className={styles.sectionsGrid}>
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>Business goal &amp; primary CTA</h3>
          <p className={styles.sectionField}>{data.businessGoal}</p>
          <p className={styles.sectionField}>
            <strong>Primary call to action:</strong> {data.primaryCta}
          </p>
          <p className={styles.sectionSummary}>{data.conversionPlan.summary}</p>
          <ul className={styles.sectionItems}>
            {data.conversionPlan.items.map((item, index) => (
              <li className={styles.sectionItem} key={index}>
                <CircleCheck
                  aria-hidden="true"
                  className={styles.sectionItemIcon}
                  size={14}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <SectionCard section={data.sitemap} title="Sitemap" />
        <SectionCard section={data.homepageSections} title="Homepage sections" />
        <SectionCard section={data.trustSignals} title="Trust signals" />
        <SectionCard section={data.localSeoPlan} title="Local SEO plan" />
        <SectionCard section={data.technologyPlan} title="Technology plan" />
        <SectionCard
          section={data.futureOpportunities}
          title="Future opportunities"
        />
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Proof sources</h2>
        {data.evidence.length === 0 ? (
          <p>No verified evidence is on file for this prospect.</p>
        ) : (
          <ul className={styles.evidenceList}>
            {data.evidence.map((item) => (
              <li className={styles.evidenceItem} key={item.id}>
                <CircleCheck
                  aria-hidden="true"
                  className={styles.evidenceIcon}
                  size={16}
                />
                <span>
                  {item.claimSummary} — {formatGrowthStatusLabel(item.sourceType)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.warningNote}>
          <TriangleAlert aria-hidden="true" size={14} style={{ flex: "none" }} />
          Every observation above is drawn from the sources listed here. Verify
          before sharing with the business.
        </p>
      </div>

      <div className={styles.disclaimer}>
        <TriangleAlert aria-hidden="true" size={18} style={{ flex: "none" }} />
        <div>
          <strong>Agent-drafted proposal</strong>
          <p>
            This strategy, including the future opportunities above, is a
            proposed scope for founder review. It is not a commitment made to
            the business.
          </p>
        </div>
      </div>
    </div>
  );
}
