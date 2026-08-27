"use client";

import { useState } from "react";

import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";

function journeyTitle(type: ProspectPreviewComposition["journey"]["type"]): string {
  switch (type) {
    case "mot-request":
      return "MOT request";
    case "quote-request":
      return "Quote request";
    case "table-enquiry":
      return "Table enquiry";
    case "valuation-request":
      return "Valuation request";
    case "consultation-request":
      return "Consultation request";
  }
}

export function CompositionJourney({
  composition,
}: {
  composition: ProspectPreviewComposition;
}) {
  const [complete, setComplete] = useState(false);
  const title = journeyTitle(composition.journey.type);

  return (
    <section className="rounded-[1.5rem] bg-[var(--preview-ink)] p-6 text-[var(--preview-background)] sm:p-10">
      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--preview-accent)]">{title}</p>
      <h2 className="mt-3 text-[clamp(1.8rem,4vw,3.25rem)] font-semibold tracking-[-0.05em] leading-none">{composition.copy.primaryCta}</h2>
      <p className="mt-4 max-w-2xl leading-6 text-[color-mix(in_srgb,var(--preview-background)_80%,transparent)]">
        {composition.content.conversionPlan.summary}
      </p>
      {complete ? (
        <p aria-live="polite" className="mt-4 leading-6 text-[color-mix(in_srgb,var(--preview-background)_80%,transparent)]">
          {composition.journey.completionMessage}
        </p>
      ) : (
        <form
          className="mt-7 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setComplete(true);
          }}
        >
          <label className="sr-only" htmlFor={`${composition.slug}-journey-detail`}>
            Your first detail
          </label>
          <input
            className="min-h-13 rounded-xl border-0 bg-[var(--preview-surface)] px-4 text-[var(--preview-ink)] outline-none ring-[var(--preview-accent)] focus:ring-4"
            id={`${composition.slug}-journey-detail`}
            placeholder="Your first detail"
            required
            type="text"
          />
          <button className="min-h-13 rounded-xl bg-[var(--preview-accent)] px-5 font-extrabold text-[var(--preview-accent-contrast)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--preview-background)]" type="submit">
            Continue
          </button>
        </form>
      )}
      <p className="mt-4 leading-6 text-[color-mix(in_srgb,var(--preview-background)_80%,transparent)]">
        Demonstration only. This form does not send or store information.
      </p>
    </section>
  );
}
