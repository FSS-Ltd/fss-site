import {
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { CommercialOffer } from "@/lib/operations/agreements/commercial-types";
import {
  agreementStage,
  stagePresentation,
} from "@/lib/operations/agreements/stage";
import styles from "./agreements.module.css";

export function CommercialOfferList({
  offers,
  audience,
}: Readonly<{
  offers: readonly CommercialOffer[];
  audience: "client" | "staff";
}>): React.JSX.Element | null {
  if (!offers.length) return null;
  return (
    <section className={styles.group} aria-label="Payment offers">
      <h2>Payment offers</h2>
      <ul className={styles.agreementList}>
        {offers.map((offer) => (
          <li key={offer.id}>
            <PortalCard title={offer.draft.title}>
              <StatusBadge status="info">
                {stagePresentation(agreementStage({ offer }), audience).label}
              </StatusBadge>
              <p>
                {offer.draft.currency} · Setup and ongoing terms are shown
                separately
              </p>
              <PortalActionLink
                href={
                  audience === "staff"
                    ? portalPath(
                        `/portal/admin/clients/${offer.organisationId}/commercial-offers/${offer.id}`,
                      )
                    : `${portalPath(`/portal/agreements/offers/${offer.id}`)}?organisationId=${offer.organisationId}`
                }
              >
                {audience === "staff"
                  ? "Review offer"
                  : "Review payment options"}
              </PortalActionLink>
            </PortalCard>
          </li>
        ))}
      </ul>
      {offers.length === 100 ? <p>The latest 100 offers are shown.</p> : null}
    </section>
  );
}
