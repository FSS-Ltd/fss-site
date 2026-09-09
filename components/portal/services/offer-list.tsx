import { OfferEnquiryForm } from "./enquiry-form";
import type { Offer } from "@/lib/operations/offers/types";
import styles from "./services.module.css";

function price(offer: Offer): string {
  if (offer.pricingDisplay === "quote" || offer.pricePence === null)
    return "Tailored quote";
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(BigInt(offer.pricePence)) / 100);
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

export function OfferList({
  offers,
  organisationId,
  canEnquire,
}: {
  offers: Offer[];
  organisationId: string;
  canEnquire: boolean;
}): React.JSX.Element {
  if (!offers.length)
    return (
      <p className={styles.empty}>
        There are no published services to explore right now. Your current work
        and support remain available elsewhere in the portal.
      </p>
    );
  return (
    <div className={styles.grid}>
      {offers.map((offer) => (
        <article className={styles.card} key={offer.id}>
          <p className={styles.price}>{price(offer)}</p>
          <h2>{offer.name}</h2>
          <p className={styles.outcome}>{offer.outcome}</p>
          <p className={styles.audience}>{offer.audience}</p>
          {!!offer.inclusions.length && (
            <div>
              <h3>Included</h3>
              <ul>
                {offer.inclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {!!offer.exclusions.length && (
            <details>
              <summary>What is outside this service</summary>
              <ul>
                {offer.exclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}
          {offer.supportHours && (
            <p className={styles.support}>{offer.supportHours}</p>
          )}
          {canEnquire ? (
            <OfferEnquiryForm
              offerId={offer.id}
              offerName={offer.name}
              organisationId={organisationId}
            />
          ) : (
            <p className={styles.note}>
              Ask an organisation owner or contributor to enquire.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
