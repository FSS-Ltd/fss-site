import { ExternalLink, Mail } from "lucide-react";
import Link from "next/link";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthDateTime,
  formatGrowthPercentage,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { DealDetail as DealDetailData } from "@/lib/growth/dashboard/deals";

import { CommercialHistory } from "./commercial-history";
import { DealActions } from "./deal-actions";
import styles from "./deals.module.css";

function stageTone(stage: DealDetailData["stage"]): "neutral" | "green" | "red" {
  if (stage === "won") return "green";
  if (stage === "lost") return "red";
  return "neutral";
}

export function DealDetailView({ deal }: { deal: DealDetailData }) {
  return (
    <div className={styles.detailPage}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/deals">Deals</Link> / {deal.business.legalName}
      </p>

      <div className={styles.card}>
        <div className={styles.detailHeader}>
          <div>
            <h1 className={styles.detailHeading}>{deal.business.legalName}</h1>
            <div className={styles.detailMeta}>
              <span>{deal.business.sector}</span>
              <span>{deal.business.locality}</span>
              <span className={styles.pill} data-tone={stageTone(deal.stage)}>
                {formatGrowthStatusLabel(deal.stage)}
              </span>
              {deal.stage === "won" && (
                <span className={styles.pill} data-tone="neutral">
                  Delivery: {formatGrowthStatusLabel(deal.deliveryStatus)}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className={styles.resultCount}>
              {deal.valueKind === "agreed" ? "Agreed value" : "Estimated value"}
            </p>
            <p className={styles.potentialValue}>
              {formatGrowthCurrency(
                (deal.oneOffValuePence ?? 0) + (deal.monthlyValuePence ?? 0),
              )}
            </p>
          </div>
        </div>
      </div>

      {deal.stage === "lost" && deal.lossReason && (
        <div className={styles.lossReason}>
          <strong>Lost:</strong> {deal.lossReason}
        </div>
      )}

      <div className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Problem evidence</h2>
            <p className={styles.contactField}>{deal.opportunitySummary}</p>
            {deal.evidence.length > 0 && (
              <ul className={styles.evidenceList}>
                {deal.evidence.map((item) => (
                  <li className={styles.evidenceItem} key={item.id}>
                    <div>
                      <span className={styles.contactName}>
                        {formatGrowthStatusLabel(item.claimType)}
                      </span>
                      <span className={styles.evidenceClaim}>{item.claimSummary}</span>
                    </div>
                    <a
                      className={styles.evidenceLink}
                      href={item.sourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Source
                      <ExternalLink aria-hidden="true" size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Proposed scope</h2>
            <p className={styles.contactName}>{deal.offerFocus}</p>
            <p className={styles.contactField}>{deal.proposedScope}</p>
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Commercial history</h2>
            <CommercialHistory history={deal.commercialHistory} />
          </div>
        </div>

        <div className={styles.detailColumn}>
          {deal.contact && (
            <div className={styles.card}>
              <p className={styles.contactName}>
                {deal.contact.firstName} {deal.contact.lastName}
              </p>
              {deal.contact.roleTitle && (
                <p className={styles.contactRole}>{deal.contact.roleTitle}</p>
              )}
              <p className={styles.contactField}>
                <Mail aria-hidden="true" size={14} />
                <a href={`mailto:${deal.contact.email}`}>{deal.contact.email}</a>
              </p>
            </div>
          )}

          {deal.correspondence && (
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Correspondence</h2>
              <p className={styles.contactField}>
                {formatGrowthStatusLabel(deal.correspondence.status)} &middot; last
                activity {formatGrowthDateTime(deal.correspondence.lastActivityAt)}
              </p>
              <Link
                className={styles.evidenceLink}
                href={`/growth/outreach/sequences/${deal.correspondence.sequenceId}`}
              >
                View full thread
                <ExternalLink aria-hidden="true" size={12} />
              </Link>
            </div>
          )}

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Next action</h2>
            {deal.nextAction ? (
              <p className={styles.contactField}>
                {deal.nextAction}
                {deal.nextActionDueAt && (
                  <span> &middot; Due {formatGrowthDate(deal.nextActionDueAt)}</span>
                )}
              </p>
            ) : (
              <p className={styles.inlineEmpty}>No next action set.</p>
            )}
            <DealActions
              currentNextAction={deal.nextAction}
              currentNextActionDueAt={deal.nextActionDueAt}
              engagementId={deal.engagementId}
              engagementVersion={deal.version}
              prospectId={deal.prospectId}
              prospectVersion={deal.prospectVersion}
              stage={deal.stage}
            />
          </div>

          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Commercial position</h2>
            <p className={styles.contactField}>
              Probability: {formatGrowthPercentage(deal.probabilityPercent / 100)}
            </p>
            {deal.expectedCloseDate && (
              <p className={styles.contactField}>
                Expected close: {formatGrowthDate(deal.expectedCloseDate)}
              </p>
            )}
            {deal.business.websiteUrl && (
              <p className={styles.contactField}>
                <a
                  href={deal.business.websiteUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {deal.business.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
                <ExternalLink aria-hidden="true" size={12} />
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
