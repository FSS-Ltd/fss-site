import type { AgreementStage } from "@/lib/operations/agreements/stage";
import styles from "./agreements.module.css";

const steps = [
  { stage: "budget_requested", label: "Budget requested" },
  { stage: "proposal_submitted", label: "Proposal submitted" },
  { stage: "approved", label: "Sent for signing" },
  { stage: "signatures_collected", label: "Signatures recorded" },
  { stage: "completed", label: "Signed copy ready" },
] as const;

export function AgreementStageTimeline({
  stage,
  fixedTerms = false,
}: Readonly<{
  stage: AgreementStage;
  fixedTerms?: boolean;
}>): React.JSX.Element {
  const current = steps.findIndex((step) => step.stage === stage);
  const position =
    stage === "pricing_choice_requested"
      ? 0
      : stage === "draft"
        ? -1
        : stage === "attention_required"
          ? 3
          : current;
  return (
    <ol className={styles.agreementTimeline} aria-label="Agreement progress">
      {steps.map((step, index) => (
        <li
          key={step.stage}
          className={
            index < position
              ? styles.timelineDone
              : index === position
                ? styles.timelineCurrent
                : undefined
          }
          aria-current={index === position ? "step" : undefined}
        >
          <span className={styles.timelineIndex}>{index + 1}</span>
          <span>
            {fixedTerms && index === 0
              ? "Payment terms sent"
              : fixedTerms && index === 1
                ? "Choice submitted"
                : step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
