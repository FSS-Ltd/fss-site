"use client";

import { useState } from "react";
import {
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  CarFront,
  DraftingCompass,
  FileLock2,
  Flower2,
  Gauge,
  Leaf,
  Sprout,
  UserRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type JourneyIconName =
  | "briefcase"
  | "calendar"
  | "calendar-clock"
  | "car"
  | "compass"
  | "flower"
  | "gauge"
  | "leaf"
  | "lock"
  | "sprout"
  | "user"
  | "wrench";

const icons: Record<JourneyIconName, LucideIcon> = {
  briefcase: BriefcaseBusiness,
  calendar: CalendarCheck2,
  "calendar-clock": CalendarClock,
  car: CarFront,
  compass: DraftingCompass,
  flower: Flower2,
  gauge: Gauge,
  leaf: Leaf,
  lock: FileLock2,
  sprout: Sprout,
  user: UserRound,
  wrench: Wrench,
};

export type JourneyStep = {
  description: string;
  icon: JourneyIconName;
  id: string;
  nextStep: string;
  number: string;
  title: string;
};

type InteractiveJourneyProps = {
  ariaLabel: string;
  description: string;
  eyebrow: string;
  heading: string;
  steps: readonly JourneyStep[];
};

export function InteractiveJourney({
  ariaLabel,
  description,
  eyebrow,
  heading,
  steps,
}: InteractiveJourneyProps) {
  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? "");
  const activeStep =
    steps.find((step) => step.id === activeStepId) ?? steps[0];

  if (!activeStep) return null;

  const ActiveIcon = icons[activeStep.icon];

  return (
    <section data-interactive-journey="true">
      <div className="grid gap-10 lg:grid-cols-[.68fr_1.32fr] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-white/55">
            {eyebrow}
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
            {heading}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/62">
            {description}
          </p>
        </div>

        <div className="grid overflow-hidden rounded-[2rem] border border-white/14 bg-black/15 shadow-[0_28px_80px_-55px_rgb(0_0_0_/_0.9)] md:grid-cols-[.82fr_1.18fr]">
          <div
            aria-label={ariaLabel}
            className="grid gap-px bg-white/10"
            role="group"
          >
            {steps.map((step) => {
              const Icon = icons[step.icon];
              const isActive = step.id === activeStep.id;

              return (
                <button
                  aria-pressed={isActive}
                  className={`flex min-h-24 items-center gap-4 p-5 text-left transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white ${
                    isActive
                      ? "bg-white text-slate-950"
                      : "bg-[#152241] text-white hover:bg-white/12"
                  }`}
                  key={step.id}
                  onClick={() => setActiveStepId(step.id)}
                  type="button"
                >
                  <span className="font-mono text-xs opacity-55">
                    {step.number}
                  </span>
                  <Icon className="size-5 shrink-0" />
                  <span className="font-bold">{step.title}</span>
                </button>
              );
            })}
          </div>

          <div
            aria-live="polite"
            className="min-h-80 bg-[#0b1328] p-7 text-white sm:p-9"
            data-interactive-journey-panel="true"
          >
            <div
              className="flex min-h-[17.5rem] flex-col justify-between"
              data-interactive-journey-content="true"
              key={activeStep.id}
            >
              <div>
                <div className="flex items-center justify-between gap-5 text-xs font-black uppercase tracking-[.18em] text-white/50">
                  <span>Selected context</span>
                  <span>{activeStep.number}</span>
                </div>
                <ActiveIcon className="mt-12 size-8 text-white/72" />
                <h3 className="mt-5 text-3xl font-semibold tracking-[-.04em]">
                  {activeStep.title}
                </h3>
                <p className="mt-4 max-w-md leading-7 text-white/66">
                  {activeStep.description}
                </p>
              </div>
              <div className="mt-10 border-t border-white/14 pt-5">
                <p className="text-[11px] font-black uppercase tracking-[.18em] text-white/45">
                  What this changes
                </p>
                <p className="mt-2 font-semibold text-white/90">
                  {activeStep.nextStep}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
