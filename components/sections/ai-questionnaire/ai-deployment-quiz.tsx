"use client";

import { ArrowRight, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";
import {
  aiQuestionnaireQuestions,
  calculateAiRecommendation,
  type AiDeploymentRecommendation,
  type AiQuestionnaireAnswers,
} from "@/lib/ai-questionnaire/scoring";
import { cn } from "@/lib/utils/cn";

const scoreLabels: Record<AiDeploymentRecommendation, string> = {
  local: "Local",
  cloud: "Cloud",
  hybrid: "Hybrid",
};

const resultAccent: Record<AiDeploymentRecommendation, string> = {
  local: "text-brand-primary",
  cloud: "text-[#a8d8ff]",
  hybrid: "text-[#b7c6f2]",
};

export function AiDeploymentQuiz() {
  const [answers, setAnswers] = useState<AiQuestionnaireAnswers>({});
  const [showResult, setShowResult] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const allQuestionsAnswered = answeredCount === aiQuestionnaireQuestions.length;
  const result = useMemo(() => calculateAiRecommendation(answers), [answers]);

  const selectAnswer = (questionId: string, optionId: string) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionId,
    }));
    setShowResult(false);
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResult(false);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)] lg:items-start">
      <GlowCard customSize className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 border-b border-border-soft/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Decision questionnaire
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Local AI or cloud AI?
            </h2>
          </div>
          <p className="rounded-full border border-border-soft bg-surface-2/70 px-4 py-2 text-sm text-text-muted">
            {answeredCount} of {aiQuestionnaireQuestions.length} answered
          </p>
        </div>

        <div className="mt-7 space-y-7">
          {aiQuestionnaireQuestions.map((question, questionIndex) => (
            <fieldset key={question.id} className="space-y-4">
              <legend className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-subtle">
                  {question.eyebrow} {String(questionIndex + 1).padStart(2, "0")}
                </span>
                <span className="block text-lg font-semibold text-foreground">
                  {question.question}
                </span>
              </legend>

              <div className="grid gap-3">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        "group rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        selected
                          ? "border-brand-primary bg-brand-primary/12 text-foreground"
                          : "border-border-soft bg-surface-2/45 text-text-muted hover:border-brand-primary/60 hover:bg-surface-2/70",
                      )}
                      onClick={() => selectAnswer(question.id, option.id)}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-brand-primary bg-brand-primary text-cta-text"
                              : "border-border-strong text-transparent group-hover:border-brand-primary",
                          )}
                          aria-hidden="true"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-text-muted">
                            {option.description}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border-soft/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            disabled={!allQuestionsAnswered}
            className="gap-2"
            onClick={() => setShowResult(true)}
          >
            Show my recommendation <ArrowRight className="size-4" />
          </Button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-text-muted transition hover:text-brand-primary"
            onClick={resetQuiz}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset answers
          </button>
        </div>
      </GlowCard>

      <div className="space-y-5 lg:sticky lg:top-24">
        <GlowCard customSize className="p-5 sm:p-6">
          {showResult && result ? (
            <div className="space-y-6" aria-live="polite">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className={cn("text-sm font-semibold uppercase tracking-[0.18em]", resultAccent[result.recommendation])}>
                    {scoreLabels[result.recommendation]} recommendation
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {result.title}
                  </h3>
                </div>
              </div>

              <p className="text-base leading-7 text-text-muted">{result.summary}</p>

              <div className="grid grid-cols-3 gap-2">
                {Object.entries(result.score).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-border-soft bg-surface-2/55 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-text-subtle">
                      {scoreLabels[key as AiDeploymentRecommendation]}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <ul className="space-y-3">
                {result.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-text-muted">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-primary" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>

              <div className="space-y-3 rounded-xl border border-border-soft bg-background/35 p-4">
                <p className="text-sm font-semibold text-foreground">Best fit</p>
                <p className="text-sm leading-6 text-text-muted">{result.bestFit}</p>
              </div>

              <div className="space-y-3 rounded-xl border border-brand-primary/25 bg-brand-primary/10 p-4">
                <p className="text-sm font-semibold text-foreground">Risk note</p>
                <p className="text-sm leading-6 text-text-muted">{result.riskNote}</p>
              </div>

              <p className="text-sm leading-6 text-text-muted">{result.ctaNote}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">
                  Your result
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Answer the questions to reveal the safest AI route.
                </h3>
              </div>
              <p className="text-sm leading-6 text-text-muted">
                The recommendation weighs data sensitivity, compliance pressure, control needs,
                infrastructure capacity, system access, and speed.
              </p>
            </div>
          )}
        </GlowCard>

        {showResult && result ? (
          <GlowCard customSize className="p-5 sm:p-6">
            <div className="mb-5 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">
                Private AI Workflow Audit
              </p>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                Turn the recommendation into a workflow map.
              </h3>
              <p className="text-sm leading-6 text-text-muted">
                Share your details and FSS will outline where local, cloud, or hybrid AI can
                reduce admin without weakening data control.
              </p>
            </div>
            <LeadMagnetCaptureForm
              resourceSlug="ai-deployment-questionnaire"
              sourceContext="ai-deployment-questionnaire"
              ctaLabel="Request a Private AI Workflow Audit"
            />
          </GlowCard>
        ) : null}
      </div>
    </div>
  );
}
