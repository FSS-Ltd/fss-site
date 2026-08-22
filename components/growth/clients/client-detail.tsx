import { ExternalLink, Mail } from "lucide-react";
import Link from "next/link";

import {
  formatGrowthCurrency,
  formatGrowthDate,
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type {
  ClientDetail as ClientDetailData,
  ClientEngagementSummary,
} from "@/lib/growth/dashboard/clients";

import styles from "./clients.module.css";
import { DeliveryStatusForm } from "./delivery-status";

function deliveryTone(
  status: ClientEngagementSummary["deliveryStatus"],
): "neutral" | "green" | "red" {
  if (status === "complete" || status === "support") return "green";
  if (status === "cancelled") return "red";
  return "neutral";
}

function EngagementCard({
  businessId,
  engagement,
}: {
  businessId: string;
  engagement: ClientEngagementSummary;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.engagementHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{engagement.name}</h2>
          <div className={styles.detailMeta}>
            <span
              className={styles.pill}
              data-tone={deliveryTone(engagement.deliveryStatus)}
            >
              {formatGrowthStatusLabel(engagement.deliveryStatus)}
            </span>
            {engagement.wonAt && <span>Won {formatGrowthDate(engagement.wonAt)}</span>}
          </div>
        </div>
        <p className={styles.potentialValue}>
          {formatGrowthCurrency(
            (engagement.oneOffValuePence ?? 0) + (engagement.monthlyValuePence ?? 0),
          )}
        </p>
      </div>

      <div className={styles.engagementGrid}>
        <div>
          {engagement.contact && (
            <p className={styles.contactField}>
              <Mail aria-hidden="true" size={14} />
              {engagement.contact.firstName} {engagement.contact.lastName}
              {" · "}
              <a href={`mailto:${engagement.contact.email}`}>
                {engagement.contact.email}
              </a>
            </p>
          )}

          {engagement.thankYouMessage && (
            <p className={styles.contactField}>
              Thank-you message:{" "}
              {formatGrowthStatusLabel(engagement.thankYouMessage.status)}
              {" · "}
              <Link
                className={styles.rowLink}
                href={`/growth/clients/${businessId}/messages/${engagement.thankYouMessage.messageId}`}
              >
                Review
                <ExternalLink aria-hidden="true" size={12} />
              </Link>
            </p>
          )}

          <h3 className={styles.sectionTitle}>Delivery history</h3>
          {engagement.deliveryHistory.length === 0 ? (
            <p className={styles.inlineEmpty}>No delivery moves recorded yet.</p>
          ) : (
            <ul className={styles.historyList}>
              {engagement.deliveryHistory.map((entry) => (
                <li className={styles.historyItem} key={entry.id}>
                  <p className={styles.historyTransition}>
                    {formatGrowthStatusLabel(entry.fromState)} →{" "}
                    {formatGrowthStatusLabel(entry.toState)}
                  </p>
                  <p className={styles.historyMeta}>
                    {formatGrowthDateTime(entry.occurredAt)}
                  </p>
                  {entry.reasonCode && (
                    <p className={styles.historyReason}>{entry.reasonCode}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={styles.sectionTitle}>Delivery</h3>
          <DeliveryStatusForm
            currentStatus={engagement.deliveryStatus}
            engagementId={engagement.engagementId}
            version={engagement.version}
          />
        </div>
      </div>
    </div>
  );
}

export function ClientDetailView({
  businessId,
  client,
}: {
  businessId: string;
  client: ClientDetailData;
}) {
  return (
    <div className={styles.detailPage}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/clients">Clients</Link> / {client.business.legalName}
      </p>

      <div className={styles.card}>
        <div className={styles.detailHeader}>
          <div>
            <h1 className={styles.detailHeading}>{client.business.legalName}</h1>
            <div className={styles.detailMeta}>
              <span>{client.business.sector}</span>
              <span>{client.business.locality}</span>
              {client.business.websiteUrl && (
                <a
                  href={client.business.websiteUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {client.business.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
          <p className={styles.resultCount}>
            {client.engagements.length}{" "}
            {client.engagements.length === 1 ? "engagement" : "engagements"}
          </p>
        </div>
      </div>

      <div className={styles.engagementList}>
        {client.engagements.map((engagement) => (
          <EngagementCard
            businessId={businessId}
            engagement={engagement}
            key={engagement.engagementId}
          />
        ))}
      </div>
    </div>
  );
}
