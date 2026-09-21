import {
  Notice,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import {
  agreementBuilderSteps,
  FounderAgreementFields,
  type AgreementBuilderStep,
} from "./founder-agreement-fields";
import styles from "./agreements.module.css";

type EngagementChoice = Readonly<{ id: string; name: string }>;

const stepLabels: Record<AgreementBuilderStep, string> = {
  document: "Document",
  fees: "Fees",
  link: "Link work",
  people: "People",
  review: "Review",
  scope: "Scope",
};

export function AgreementBuilder({
  children,
  engagementChoices,
  engagementHref,
  organisationName,
  step,
}: Readonly<{
  children?: React.ReactNode;
  engagementChoices: readonly EngagementChoice[];
  engagementHref: string;
  organisationName: string;
  step: AgreementBuilderStep;
}>): React.JSX.Element {
  const hasEligibleEngagement = engagementChoices.length > 0;

  return (
    <section
      className={styles.builder}
      aria-labelledby="agreement-builder-heading"
    >
      <div className={styles.builderHeading}>
        <div>
          <p className={styles.version}>{organisationName}</p>
          <h2 id="agreement-builder-heading">Create an agreement</h2>
          <p className={styles.muted}>
            The authoritative form saves a complete validated agreement draft.
          </p>
        </div>
        <StatusBadge status="info">
          Step {agreementBuilderSteps.indexOf(step) + 1} of{" "}
          {agreementBuilderSteps.length}
        </StatusBadge>
      </div>
      <ol className={styles.builderSteps} aria-label="Agreement builder steps">
        {agreementBuilderSteps.map((item, index) => (
          <li aria-current={item === step ? "step" : undefined} key={item}>
            <span>{index + 1}</span>
            {stepLabels[item]}
          </li>
        ))}
      </ol>
      <FounderAgreementFields step={step} />
      {!hasEligibleEngagement ? (
        <Notice
          action={
            <PortalActionLink href={engagementHref}>
              Create &amp; link engagement
            </PortalActionLink>
          }
          tone="warning"
        >
          <strong>No engagement is linked.</strong>
          <p>
            Link reviewed work before creating an agreement. There is no
            UUID-only selector because an eligible engagement is required by the
            server.
          </p>
        </Notice>
      ) : (
        <>
          <PortalCard title="Eligible reviewed work">
            <ul className={styles.schedule}>
              {engagementChoices.map((engagement) => (
                <li key={engagement.id}>
                  <span>{engagement.name}</span>
                </li>
              ))}
            </ul>
          </PortalCard>
          {children}
        </>
      )}
    </section>
  );
}
