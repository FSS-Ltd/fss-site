"use client";

import { useState } from "react";
import { Notice, StatusBadge } from "@/components/portal/ui";
import type {
  AgreementBuilderDraftContent,
  AgreementBuilderStep,
} from "@/lib/operations/agreements/builder-draft-schema";
import type { AgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-service";
import {
  AgreementBuilderStepPanel,
  agreementBuilderStepDetail,
  agreementBuilderSteps,
  type AgreementEngagementChoice,
} from "./agreement-builder-step-panel";
import { useAgreementBuilderDraft } from "./use-agreement-builder-draft";
import styles from "./agreements.module.css";

export type { AgreementEngagementChoice } from "./agreement-builder-step-panel";

export function StaffAgreementBuilder({
  agreementListHref,
  baseHref,
  commandEndpoint,
  engagementHref,
  engagements,
  initialDraft,
  onNavigate,
  organisationName,
}: Readonly<{
  agreementListHref?: string;
  baseHref: string;
  commandEndpoint: string;
  engagementHref: string;
  engagements: readonly AgreementEngagementChoice[];
  initialDraft: AgreementBuilderDraft | null;
  onNavigate?: (href: string) => void;
  organisationName: string;
}>): React.JSX.Element {
  const listHref = agreementListHref ?? baseHref.replace(/\/new$/, "");
  const { draft, finalise, message, pending, save } = useAgreementBuilderDraft({
    agreementListHref: listHref,
    baseHref,
    commandEndpoint,
    initialDraft,
    navigate: onNavigate,
  });
  const [content, setContent] = useState<AgreementBuilderDraftContent>(
    initialDraft?.content ?? {},
  );
  const [step, setStep] = useState<AgreementBuilderStep>(
    initialDraft?.step ?? "link",
  );
  const agreement = content.agreement ?? {};
  const currentStepIndex = agreementBuilderSteps.indexOf(step) + 1;

  async function persist(
    nextStep: AgreementBuilderStep,
    nextContent: AgreementBuilderDraftContent,
  ): Promise<void> {
    const saved = await save(nextStep, nextContent);
    if (!saved) return;
    setContent(saved.content);
    setStep(saved.step);
  }

  return (
    <section className={styles.builder} aria-labelledby="staff-agreement-builder-heading">
      <div className={styles.builderHeading}>
        <div>
          <p className={styles.version}>{organisationName}</p>
          <h2 id="staff-agreement-builder-heading">Create an agreement</h2>
          <p className={styles.muted}>
            Saved drafts stay scoped to this client and are checked again before
            they become an agreement record.
          </p>
        </div>
        <StatusBadge status="info">
          Step {currentStepIndex} of {agreementBuilderSteps.length}
        </StatusBadge>
      </div>
      <ol className={styles.builderSteps} aria-label="Agreement builder steps">
        {agreementBuilderSteps.map((item, index) => (
          <li aria-current={item === step ? "step" : undefined} key={item}>
            <span>{index + 1}</span>
            {agreementBuilderStepDetail(item).label}
          </li>
        ))}
      </ol>
      <p className={styles.stepCaption}>
        Step {currentStepIndex} of 6 / {agreementBuilderStepDetail(step).summary}
      </p>
      {message ? <Notice tone="info"><p>{message}</p></Notice> : null}
      <AgreementBuilderStepPanel
        agreement={agreement}
        content={content}
        draftExists={Boolean(draft)}
        engagementHref={engagementHref}
        engagements={engagements}
        finalise={finalise}
        onSave={persist}
        organisationName={organisationName}
        pending={pending}
        step={step}
      />
    </section>
  );
}
