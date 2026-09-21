import { ArrowRight } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { penceToGbp } from "@/lib/operations/agreements/money-input";
import type { Offer } from "@/lib/operations/offers/types";
import styles from "./services.module.css";

export function offerPrice(offer: Offer): string {
  if (offer.pricingDisplay === "quote" || offer.pricePence === null)
    return "Tailored quote";
  const [whole, fraction] = penceToGbp(offer.pricePence).split(".");
  const formatted = `£${new Intl.NumberFormat("en-GB").format(
    BigInt(whole),
  )}.${fraction}`;
  const cadence =
    offer.recurrence === "monthly"
      ? " / month"
      : offer.recurrence === "annual"
        ? " / year"
        : offer.recurrence === "quarterly"
          ? " / quarter"
          : "";
  return `${offer.pricingDisplay === "from" ? "From " : ""}${formatted}${cadence}`;
}

function enquiryHref(offerId: string, organisationId: string): string {
  const search = new URLSearchParams({ organisationId });
  return `${portalPath(`/portal/services/${offerId}/enquire`)}?${search.toString()}`;
}

export function ClientServiceCatalogue({
  canEnquire,
  offers,
  organisationId,
}: {
  canEnquire: boolean;
  offers: readonly Offer[];
  organisationId: string;
}): React.JSX.Element {
  return (
    <div className={styles.workspace}>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { label: "Services" },
        ]}
        description="Clear service options for conversations about your next outcome."
        eyebrow="Services"
        title="Support for what comes next."
      />
      <Notice tone="info">
        <strong>A conversation first.</strong> It does not activate a service or
        charge your payment method. FSS will prepare a proposal before any work
        begins.
      </Notice>
      {offers.length === 0 ? (
        <PortalCard title="No published services">
          <p className={styles.note}>
            There are no published services to explore right now. Your current
            work and support remain available elsewhere in the portal.
          </p>
        </PortalCard>
      ) : (
        <div className={styles.grid}>
          {offers.map((offer) => (
            <PortalCard
              description={offer.audience}
              headingId={`service-${offer.id}`}
              key={offer.id}
              title={offer.name}
            >
              <p className={styles.price}>{offerPrice(offer)}</p>
              <p className={styles.outcome}>{offer.outcome}</p>
              {offer.inclusions.length > 0 ? (
                <div className={styles.listSection}>
                  <h3>Included</h3>
                  <ul>
                    {offer.inclusions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {offer.exclusions.length > 0 ? (
                <div className={styles.listSection}>
                  <h3>Outside this service</h3>
                  <ul>
                    {offer.exclusions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {offer.supportHours ? (
                <p className={styles.support}>{offer.supportHours}</p>
              ) : null}
              {canEnquire ? (
                <PortalActionLink
                  href={enquiryHref(offer.id, organisationId)}
                  variant="primary"
                >
                  Ask about {offer.name}{" "}
                  <ArrowRight aria-hidden="true" size={16} />
                </PortalActionLink>
              ) : (
                <Notice tone="warning">
                  Ask an organisation owner or contributor to enquire.
                </Notice>
              )}
            </PortalCard>
          ))}
        </div>
      )}
    </div>
  );
}
