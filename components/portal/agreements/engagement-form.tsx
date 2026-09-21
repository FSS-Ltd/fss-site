import {
  Notice,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "./agreements.module.css";

export function EngagementForm({
  agreementHref,
  engagementChoices,
}: Readonly<{
  agreementHref: string;
  engagementChoices: readonly { id: string; name: string }[];
}>): React.JSX.Element {
  return (
    <section
      className={styles.detail}
      aria-labelledby="engagement-provenance-heading"
    >
      <PortalCard
        description="Agreements can only use reviewed work already linked to this client organisation."
        title="Create an engagement"
      >
        <Notice tone="info">
          <strong>Review status</strong>
          <p>
            The reviewed mapping is the provenance boundary. This Studio screen
            does not create a free-form engagement or change that mapping.
          </p>
        </Notice>
        {engagementChoices.length ? (
          <ul className={styles.schedule} aria-label="Reviewed engagements">
            {engagementChoices.map((engagement) => (
              <li key={engagement.id}>
                <span>{engagement.name}</span>
                <StatusBadge status="success">
                  Eligible for agreement work
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <Notice tone="warning">
            <strong>No reviewed engagement is available.</strong>
            <p>
              Complete the reviewed organisation mapping before an agreement can
              be created for this client.
            </p>
          </Notice>
        )}
      </PortalCard>
      <PortalActionLink href={agreementHref} variant="secondary">
        Back to agreement builder
      </PortalActionLink>
    </section>
  );
}
