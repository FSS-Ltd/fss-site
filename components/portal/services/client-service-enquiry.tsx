import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { Offer } from "@/lib/operations/offers/types";
import { OfferEnquiryForm } from "./enquiry-form";
import { offerPrice } from "./client-service-catalogue";
import styles from "./services.module.css";

export function ClientServiceEnquiry({
  contactEmail,
  offer,
  organisationId,
}: {
  contactEmail: string;
  offer: Offer;
  organisationId: string;
}): React.JSX.Element {
  return (
    <div className={styles.workspace}>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { href: portalPath("/portal/services"), label: "Services" },
          { label: offer.name },
        ]}
        description="Tell FSS what support would make the next step easier."
        eyebrow="Service enquiry"
        title="Tell us what you need"
      />
      <Notice tone="info">
        <MessageCircle aria-hidden="true" size={18} /> FSS will review your
        enquiry and follow up with a proposed scope and price.
      </Notice>
      <div className={styles.enquiryGrid}>
        <PortalCard title={offer.name} description={offer.audience}>
          <p className={styles.price}>{offerPrice(offer)}</p>
          <p className={styles.outcome}>{offer.outcome}</p>
          <p className={styles.contact}>
            <Mail aria-hidden="true" size={16} /> {contactEmail}
          </p>
        </PortalCard>
        <PortalCard title="Your enquiry">
          <OfferEnquiryForm
            offerId={offer.id}
            offerName={offer.name}
            organisationId={organisationId}
          />
        </PortalCard>
      </div>
      <PortalActionLink
        href={`${portalPath("/portal/services")}?${new URLSearchParams({ organisationId }).toString()}`}
        variant="quiet"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Back to services
      </PortalActionLink>
    </div>
  );
}
