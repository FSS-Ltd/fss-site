import { ExternalLink, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { ProspectDetail as ProspectDetailData } from "@/lib/growth/dashboard/prospect-detail";
import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";

import { EvidenceList } from "./evidence-list";
import { PreviewApproval } from "./preview-approval";
import { ProspectActions } from "./prospect-actions";
import styles from "./prospects.module.css";
import { WebsiteAssessment } from "./website-assessment";

type ScoreRingStyle = CSSProperties & Record<`--${string}`, string | number>;

export function ProspectDetailView({
  integrations,
  now,
  prospect,
}: {
  integrations: readonly IntegrationHealth[];
  now: string;
  prospect: ProspectDetailData;
}) {
  return (
    <div className={styles.detailPage}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/prospects">Prospects</Link> /{" "}
        {prospect.business.legalName}
      </p>

      <div className={styles.card}>
        <div className={styles.detailHeader}>
          <span
            className={styles.detailScoreRing}
            data-score={prospect.fitScore}
            style={{ "--score": prospect.fitScore } as ScoreRingStyle}
          />
          <div>
            <h1 className={styles.detailHeading}>
              {prospect.business.legalName}
            </h1>
            <div className={styles.detailMeta}>
              <span>{prospect.business.sector}</span>
              <span>
                <MapPin
                  aria-hidden="true"
                  size={13}
                  style={{ marginRight: 3, verticalAlign: "-2px" }}
                />
                {prospect.business.locality}, Kent
              </span>
              <span>
                {prospect.business.corporateStatus === "active"
                  ? "Verified company"
                  : formatGrowthStatusLabel(prospect.business.corporateStatus)}
              </span>
              <span className={styles.pill} data-tone="neutral">
                {formatGrowthStatusLabel(prospect.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Why this prospect fits</h2>
            <p className={styles.contactField}>{prospect.opportunitySummary}</p>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Recommended offer</h2>
            <p className={styles.contactName}>{prospect.recommendedOffer}</p>
            <p className={styles.contactField}>
              Estimated one-off value:{" "}
              {formatGrowthCurrency(prospect.estimatedOneOffMinPence)}–
              {formatGrowthCurrency(prospect.estimatedOneOffMaxPence)}
            </p>
            {prospect.estimatedMonthlyPence > 0 && (
              <p className={styles.contactField}>
                Future support:{" "}
                {formatGrowthCurrency(prospect.estimatedMonthlyPence)}/mo
              </p>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.resultsHeader}>
              <h2 className={styles.sectionTitle}>Research evidence</h2>
              <span className={styles.resultCount}>
                {prospect.evidence.length} evidence{" "}
                {prospect.evidence.length === 1 ? "piece" : "pieces"}
              </span>
            </div>
            <EvidenceList evidence={prospect.evidence} />
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Website assessment</h2>
            <WebsiteAssessment
              assessment={prospect.websiteAssessment}
              prospectId={prospect.id}
            />
            <div className="mt-6 border-t border-slate-200 pt-6">
              <h3 className={styles.sectionTitle}>Private concept preview</h3>
              <PreviewApproval
                businessName={
                  prospect.business.tradingName ?? prospect.business.legalName
                }
                preview={prospect.preview}
                prospectId={prospect.id}
                prospectStatus={prospect.status}
                prospectVersion={prospect.version}
              />
            </div>
          </div>
        </div>

        <div className={styles.detailColumn}>
          {prospect.contact && (
            <div className={styles.card}>
              <div className={styles.contactCard}>
                <p className={styles.contactName}>
                  {prospect.contact.firstName} {prospect.contact.lastName}
                </p>
                {prospect.contact.roleTitle && (
                  <p className={styles.contactRole}>{prospect.contact.roleTitle}</p>
                )}
                <p className={styles.contactField}>
                  <Mail aria-hidden="true" size={14} />
                  <a href={`mailto:${prospect.contact.email}`}>
                    {prospect.contact.email}
                  </a>
                  <span className={styles.pill}>Verified</span>
                </p>
              </div>
            </div>
          )}

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Next action</h2>
            {prospect.nextAction && (
              <p className={styles.contactField}>
                {prospect.nextAction}
                {prospect.nextActionDueAt && (
                  <span> · Due {formatGrowthDate(prospect.nextActionDueAt)}</span>
                )}
              </p>
            )}
            <ProspectActions
              integrations={integrations}
              now={now}
              prospect={prospect}
            />
          </div>

          <div className={styles.card}>
            <p className={styles.resultCount}>Potential value</p>
            <p className={styles.potentialValue}>
              {formatGrowthCurrency(prospect.estimatedOneOffMaxPence)}
            </p>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Corporate verification</h2>
            {prospect.business.companyNumber && (
              <p className={styles.contactField}>
                Company number: {prospect.business.companyNumber}
              </p>
            )}
            <p className={styles.contactField}>
              {formatGrowthStatusLabel(prospect.business.corporateType)},{" "}
              {formatGrowthStatusLabel(prospect.business.corporateStatus)}
            </p>
            {prospect.business.websiteUrl ? (
              <p className={styles.contactField}>
                <a
                  href={prospect.business.websiteUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {prospect.business.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
                <ExternalLink aria-hidden="true" size={12} />
              </p>
            ) : (
              <p className={styles.contactField}>No active website</p>
            )}
            {prospect.business.googleMapsReferenceUrl && (
              <p className={styles.contactField}>
                <a
                  href={prospect.business.googleMapsReferenceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Maps reference
                </a>
                <ExternalLink aria-hidden="true" size={12} />
              </p>
            )}
            <p className={styles.contactField}>
              Verified {formatGrowthDate(prospect.business.verifiedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
