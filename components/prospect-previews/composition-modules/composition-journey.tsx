"use client";

import { useState } from "react";

import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";
import type { ExperienceBrief } from "@/lib/growth/prospect-previews/experience-brief";

type EvidenceBackedComposition = Extract<
  ProspectPreviewComposition,
  { schemaVersion: "1.1" }
>;
type EvidenceBackedJourneyStep = ExperienceBrief["journey"]["steps"][number];

function StepControl({
  slug,
  step,
}: {
  slug: string;
  step: EvidenceBackedJourneyStep;
}) {
  const fieldId = `${slug}-${step.id}`;
  const isRequired = step.requiredFields.length > 0;

  if (step.control === "registration") {
    return (
      <input
        aria-label={step.label}
        autoCapitalize="characters"
        className="min-h-13 rounded-xl border-0 bg-[var(--preview-surface)] px-4 text-[var(--preview-ink)] outline-none ring-[var(--preview-accent)] focus:ring-4"
        id={fieldId}
        name={step.id}
        placeholder="AB12 CDE"
        required={isRequired}
        type="text"
      />
    );
  }

  if (step.control === "textarea") {
    return (
      <textarea
        aria-label={step.label}
        className="min-h-28 rounded-xl border-0 bg-[var(--preview-surface)] px-4 py-3 text-[var(--preview-ink)] outline-none ring-[var(--preview-accent)] focus:ring-4"
        id={fieldId}
        name={step.id}
        placeholder="Add a short note"
        required={isRequired}
      />
    );
  }

  if (step.control === "single-select" || step.control === "multi-select") {
    const inputType = step.control === "single-select" ? "radio" : "checkbox";
    return (
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="sr-only">{step.label}</legend>
        {step.options.map((option, index) => (
          <label
            className="flex cursor-pointer items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--preview-background)_12%,transparent)] px-4 py-3 text-sm font-semibold"
            key={option}
          >
            <input
              className="size-4 accent-[var(--preview-accent)]"
              defaultChecked={index === 0 && !isRequired}
              name={step.id}
              required={isRequired && index === 0}
              type={inputType}
              value={option}
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }

  if (step.control === "contact-details") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          aria-label="Your name"
          className="min-h-13 rounded-xl border-0 bg-[var(--preview-surface)] px-4 text-[var(--preview-ink)] outline-none ring-[var(--preview-accent)] focus:ring-4"
          name={`${step.id}-name`}
          placeholder="Your name"
          required={isRequired}
          type="text"
        />
        <input
          aria-label="Your email"
          className="min-h-13 rounded-xl border-0 bg-[var(--preview-surface)] px-4 text-[var(--preview-ink)] outline-none ring-[var(--preview-accent)] focus:ring-4"
          name={`${step.id}-email`}
          placeholder="Your email"
          required={isRequired}
          type="email"
        />
      </div>
    );
  }

  return (
    <p className="rounded-xl bg-[color-mix(in_srgb,var(--preview-background)_12%,transparent)] px-4 py-3 text-sm leading-6">
      Check the details above, then complete this private demonstration.
    </p>
  );
}

function EvidenceBackedJourney({
  composition,
}: {
  composition: EvidenceBackedComposition;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const journey = composition.journey;
  const step = journey.steps[stepIndex];

  if (step === undefined) return null;

  return (
    <section className="rounded-[1.5rem] bg-[var(--preview-ink)] p-6 text-[var(--preview-background)] sm:p-10">
      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--preview-accent)]">
        {journey.title}
      </p>
      <h2 className="mt-3 text-[clamp(1.8rem,4vw,3.25rem)] font-semibold tracking-[-0.05em] leading-none">
        {step.label}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--preview-background)_76%,transparent)]">
        Step {stepIndex + 1} of {journey.steps.length}
      </p>
      {complete ? (
        <p aria-live="polite" className="mt-6 max-w-2xl leading-6 text-[color-mix(in_srgb,var(--preview-background)_84%,transparent)]">
          {journey.completionMessage}
        </p>
      ) : (
        <form
          className="mt-7 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (stepIndex === journey.steps.length - 1) {
              setComplete(true);
              return;
            }
            setStepIndex((index) => index + 1);
          }}
        >
          <StepControl slug={composition.slug} step={step} />
          <div className="flex flex-wrap gap-3">
            {stepIndex > 0 ? (
              <button
                className="min-h-12 rounded-xl border border-[color-mix(in_srgb,var(--preview-background)_35%,transparent)] px-5 font-extrabold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--preview-background)]"
                onClick={() => setStepIndex((index) => index - 1)}
                type="button"
              >
                Back
              </button>
            ) : null}
            <button
              className="min-h-12 rounded-xl bg-[var(--preview-accent)] px-5 font-extrabold text-[var(--preview-accent-contrast)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--preview-background)]"
              type="submit"
            >
              {stepIndex === journey.steps.length - 1
                ? "Complete preview"
                : "Continue"}
            </button>
          </div>
        </form>
      )}
      <p className="mt-5 leading-6 text-[color-mix(in_srgb,var(--preview-background)_76%,transparent)]">
        Demonstration only. This form does not send or store information.
      </p>
    </section>
  );
}

export function CompositionJourney({
  composition,
}: {
  composition: ProspectPreviewComposition;
}) {
  if (composition.schemaVersion === "1.1") {
    return <EvidenceBackedJourney composition={composition} />;
  }

  return (
    <section className="rounded-[1.5rem] bg-[var(--preview-ink)] p-6 text-[var(--preview-background)] sm:p-10">
      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--preview-accent)]">
        Private concept
      </p>
      <h2 className="mt-3 text-[clamp(1.8rem,4vw,3.25rem)] font-semibold tracking-[-0.05em] leading-none">
        A tailored journey is awaiting first-party research.
      </h2>
      <p className="mt-5 leading-6 text-[color-mix(in_srgb,var(--preview-background)_76%,transparent)]">
        Demonstration only. This concept does not collect, send or store information.
      </p>
    </section>
  );
}
