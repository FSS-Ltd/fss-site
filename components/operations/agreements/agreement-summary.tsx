import type { AgreementRegister } from "@/lib/operations/agreements/types";
import {
  DashboardMetric,
  DistributionBars,
  DonutChart,
} from "../dashboard/dashboard-visuals";
import styles from "./agreements.module.css";

export function AgreementSummary({
  register,
}: {
  register: AgreementRegister;
}): React.JSX.Element | null {
  if (register.agreements.length === 0) return null;

  const signed = register.agreements.filter(
    (agreement) => agreement.status === "signed",
  );
  const drafts = register.agreements.length - signed.length;
  const signedServiceLines = signed.reduce(
    (sum, agreement) => sum + agreement.draft.lines.length,
    0,
  );
  const activeServices = signed.reduce(
    (sum, agreement) => sum + agreement.services.length,
    0,
  );
  const awaitingActivation = Math.max(signedServiceLines - activeServices, 0);

  return (
    <section
      className={styles.summary}
      aria-labelledby="agreement-summary-heading"
    >
      <div className={styles.summaryHeading}>
        <p className={styles.eyebrow}>Agreement health</p>
        <h2 id="agreement-summary-heading">
          From agreed terms to active service
        </h2>
        <p>
          Signed evidence and service activation are separate controls. This
          view shows what has been agreed and what is ready to deliver.
        </p>
      </div>
      <div className={styles.summaryMetrics}>
        <DashboardMetric
          label="Agreements shown"
          supportingText="Agreement records in the current register page."
          value={register.agreements.length.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Signed terms"
          signal={
            drafts > 0
              ? {
                  label: `${drafts} draft${drafts === 1 ? " is" : "s are"} awaiting evidence`,
                  tone: "warning",
                }
              : { label: "All shown agreements are signed", tone: "positive" }
          }
          supportingText="Agreements with recorded signing evidence."
          value={`${signed.length} / ${register.agreements.length}`}
        />
        <DashboardMetric
          label="Service activation"
          signal={
            awaitingActivation > 0
              ? { label: "Signed work needs activation", tone: "warning" }
              : {
                  label: "All signed service lines are active",
                  tone: "positive",
                }
          }
          supportingText="Signed service lines with an effective service record."
          value={`${activeServices} / ${signedServiceLines}`}
        />
      </div>
      <div className={styles.summaryVisuals}>
        <DonutChart
          centerLabel="Service lines"
          description={`${activeServices.toLocaleString("en-GB")} of ${signedServiceLines.toLocaleString("en-GB")} signed service lines are active. Activate only after the required operational evidence has been recorded.`}
          segments={[
            {
              label: "Active service",
              tone: "positive",
              value: activeServices,
            },
            {
              label: "Signed, awaiting activation",
              tone: "warning",
              value: awaitingActivation,
            },
          ]}
          title="Signed service activation"
        />
        <DistributionBars
          description="Drafts cannot produce an effective service. Signed agreements move into operational activation only when their evidence is complete."
          items={[
            { label: "Signed", tone: "positive", value: signed.length },
            { label: "Draft", tone: "warning", value: drafts },
          ]}
          title="Agreement state"
        />
      </div>
    </section>
  );
}
