"use client";

import type { Currency } from "@/lib/operations/money";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/portal/ui";
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
import guidedStyles from "./agreement-builder.module.css";

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
  currency = "GBP",
}: Readonly<{
  agreementListHref?: string;
  baseHref: string;
  commandEndpoint: string;
  engagementHref: string;
  engagements: readonly AgreementEngagementChoice[];
  initialDraft: AgreementBuilderDraft | null;
  onNavigate: (href: string) => void;
  organisationName: string;
  currency?: Currency;
}>): React.JSX.Element {
  const listHref = agreementListHref ?? baseHref.replace(/\/new$/, "");
  const { draft, finalise, feedback, pending, pendingMessage, save } =
    useAgreementBuilderDraft({
      agreementListHref: listHref,
      baseHref,
      commandEndpoint,
      initialDraft,
      navigate: onNavigate,
    });
  const [content, setContent] = useState<AgreementBuilderDraftContent>(
    initialDraft?.content ?? { agreement: { currency } },
  );
  const [step, setStep] = useState<AgreementBuilderStep>(
    initialDraft?.step ?? "link",
  );
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step === "document" || step === "review") {
      stageRef.current?.querySelector<HTMLElement>("h2")?.focus();
    }
  }, [step]);
  const agreement = content.agreement ?? {};
  const currentStepIndex = agreementBuilderSteps.indexOf(step) + 1;

  async function persist(
    nextStep: AgreementBuilderStep,
    nextContent: AgreementBuilderDraftContent,
  ): Promise<void> {
    const saved = await save(nextStep, nextContent);
    if (!saved) return;
    setDirection(
      agreementBuilderSteps.indexOf(saved.step) < currentStepIndex - 1
        ? "backward"
        : "forward",
    );
    setContent(saved.content);
    setStep(saved.step);
  }

  async function beginEngagement(
    nextContent: AgreementBuilderDraftContent,
  ): Promise<void> {
    const saved = await save("link", nextContent);
    if (!saved) return;
    setDirection(
      agreementBuilderSteps.indexOf(saved.step) < currentStepIndex - 1
        ? "backward"
        : "forward",
    );
    setContent(saved.content);
    setStep(saved.step);
    const destination = new URL(engagementHref, window.location.origin);
    destination.searchParams.set("draftId", saved.id);
    destination.searchParams.set("expectedVersion", String(saved.version));
    const href = `${destination.pathname}${destination.search}`;
    onNavigate(href);
  }

  return (
    <section
      className={styles.builder}
      aria-labelledby="staff-agreement-builder-heading"
    >
      <div>
        <p className={styles.version}>{organisationName}</p>
        <h2
          className={guidedStyles.visuallyHidden}
          id="staff-agreement-builder-heading"
        >
          Create an agreement
        </h2>
      </div>
      <ol
        className={guidedStyles.progress}
        aria-label="Agreement builder steps"
      >
        {agreementBuilderSteps.map((item, index) => (
          <li
            aria-current={item === step ? "step" : undefined}
            data-complete={index < currentStepIndex - 1}
            key={item}
          >
            {agreementBuilderStepDetail(item).label}
          </li>
        ))}
      </ol>
      {feedback?.tone === "error" ? (
        <Notice tone="error">
          <p>{feedback.message}</p>
        </Notice>
      ) : null}
      <p aria-live="polite" className={guidedStyles.saveStatus} role="status">
        {pending
          ? pendingMessage
          : feedback?.tone === "success"
            ? feedback.message
            : ""}
      </p>
      <div
        className={guidedStyles.stage}
        data-direction={direction}
        key={step}
        ref={stageRef}
      >
        <AgreementBuilderStepPanel
          agreement={agreement}
          content={content}
          draftExists={Boolean(draft)}
          engagementHref={engagementHref}
          engagements={engagements}
          finalise={finalise}
          onSave={persist}
          onBeginEngagement={beginEngagement}
          organisationName={organisationName}
          pending={pending}
          step={step}
        />
      </div>
    </section>
  );
}
