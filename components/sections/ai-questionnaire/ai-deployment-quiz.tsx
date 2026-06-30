"use client";

import { ArrowRight, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";
import { Button } from "@/components/ui/button";
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
  local: "text-[#0f7a83]",
  cloud: "text-[#0a1a2e]",
  hybrid: "text-[#56657a]",
};

export function AiDeploymentQuiz() {
  const [answers, setAnswers] = useState<AiQuestionnaireAnswers>({});
  const [showResult, setShowResult] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const allQuestionsAnswered =
    answeredCount === aiQuestionnaireQuestions.length;
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
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div
        data-lift-light
        className="rounded-[22px] border border-[rgba(10,26,46,.08)] bg-white p-5 shadow-[0_40px_90px_-55px_rgba(10,26,46,.45)] sm:p-7"
      >
        <div className="flex flex-col gap-4 border-b border-[rgba(10,26,46,.08)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#0f7a83]">
              Decision questionnaire
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0a1a2e] sm:text-3xl">
              Local AI or cloud AI?
            </h2>
          </div>
          <p className="rounded-full border border-[rgba(10,26,46,.1)] bg-[#f7f8f9] px-4 py-2 text-sm text-[#56657a]">
            {answeredCount} of {aiQuestionnaireQuestions.length} answered
          </p>
        </div>

        <div className="mt-7 space-y-7">
          {aiQuestionnaireQuestions.map((question, questionIndex) => (
            <fieldset key={question.id} className="space-y-4">
              <legend className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#7b8798]">
                  {question.eyebrow}{" "}
                  {String(questionIndex + 1).padStart(2, "0")}
                </span>
                <span className="block text-lg font-semibold text-[#0a1a2e]">
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
                        "group rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14989e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                        selected
                          ? "border-[#14989e] bg-[rgba(20,152,158,.1)] text-[#0a1a2e]"
                          : "border-[rgba(10,26,46,.1)] bg-[#f7f8f9] text-[#56657a] hover:border-[rgba(20,152,158,.45)] hover:bg-white",
                      )}
                      onClick={() => selectAnswer(question.id, option.id)}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-[#14989e] bg-[#14989e] text-[#fff]"
                              : "border-[rgba(10,26,46,.24)] text-transparent group-hover:border-[#14989e]",
                          )}
                          aria-hidden="true"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#0a1a2e]">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-[#56657a]">
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

        <div className="mt-8 flex flex-col gap-3 border-t border-[rgba(10,26,46,.08)] pt-5 sm:flex-row sm:items-center sm:justify-between">
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
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#56657a] transition hover:text-[#0f7a83]"
            onClick={resetQuiz}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset answers
          </button>
        </div>
      </div>

      <div className="space-y-5 lg:sticky lg:top-24">
        <div className="rounded-[22px] border border-[rgba(10,26,46,.08)] bg-white p-5 shadow-[0_40px_90px_-55px_rgba(10,26,46,.45)] sm:p-6">
          {showResult && result ? (
            <div className="space-y-6" aria-live="polite">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[rgba(20,152,158,.12)] text-[#0f7a83]">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p
                    className={cn(
                      "text-sm font-semibold uppercase tracking-widest",
                      resultAccent[result.recommendation],
                    )}
                  >
                    {scoreLabels[result.recommendation]} recommendation
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#0a1a2e]">
                    {result.title}
                  </h3>
                </div>
              </div>

              <p className="text-base leading-7 text-[#56657a]">
                {result.summary}
              </p>

              <div className="grid grid-cols-3 gap-2">
                {Object.entries(result.score).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-[rgba(10,26,46,.08)] bg-[#f7f8f9] p-3"
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#7b8798]">
                      {scoreLabels[key as AiDeploymentRecommendation]}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-[#0a1a2e]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <ul className="space-y-3">
                {result.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-3 text-sm leading-6 text-[#56657a]"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[#0f7a83]"
                      aria-hidden="true"
                    />
                    {bullet}
                  </li>
                ))}
              </ul>

              <div className="space-y-3 rounded-xl border border-[rgba(10,26,46,.08)] bg-[#f7f8f9] p-4">
                <p className="text-sm font-semibold text-[#0a1a2e]">Best fit</p>
                <p className="text-sm leading-6 text-[#56657a]">
                  {result.bestFit}
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-[rgba(20,152,158,.25)] bg-[rgba(20,152,158,.1)] p-4">
                <p className="text-sm font-semibold text-[#0a1a2e]">
                  Risk note
                </p>
                <p className="text-sm leading-6 text-[#56657a]">
                  {result.riskNote}
                </p>
              </div>

              <p className="text-sm leading-6 text-[#56657a]">
                {result.ctaNote}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <span className="flex size-11 items-center justify-center rounded-full bg-[rgba(20,152,158,.12)] text-[#0f7a83]">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-[#0f7a83]">
                  Your result
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[#0a1a2e]">
                  Answer the questions to reveal the safest AI route.
                </h3>
              </div>
              <p className="text-sm leading-6 text-[#56657a]">
                The recommendation weighs data sensitivity, compliance pressure,
                control needs, infrastructure capacity, system access, and
                speed.
              </p>
            </div>
          )}
        </div>

        {showResult && result ? (
          <div className="rounded-[22px] border border-[rgba(10,26,46,.08)] bg-white p-5 shadow-[0_40px_90px_-55px_rgba(10,26,46,.45)] sm:p-6">
            <div className="mb-5 space-y-2">
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-[#0f7a83]">
                Private AI Workflow Audit
              </p>
              <h3 className="text-2xl font-semibold text-[#0a1a2e]">
                Turn the recommendation into a workflow map.
              </h3>
              <p className="text-sm leading-6 text-[#56657a]">
                Share your details and FSS will outline where local, cloud, or
                hybrid AI can reduce admin without weakening data control.
              </p>
            </div>
            <LeadMagnetCaptureForm
              resourceSlug="ai-deployment-questionnaire"
              sourceContext="ai-deployment-questionnaire"
              ctaLabel="Request a Private AI Workflow Audit"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
