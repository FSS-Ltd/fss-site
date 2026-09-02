"use client";

import { useState } from "react";
import { ArrowUpRight, Check, CircleAlert } from "lucide-react";

const scenarios = [
  {
    id: "starting",
    label: "Starting out",
    focus: "Build the right finance rhythm before work multiplies.",
    nextMove: "Clarify the structure, first reporting rhythm and tax dates.",
    signal: "Foundation in view",
    status: "Foundation call",
    tasks: ["Trading structure", "First reporting date", "Bookkeeping rhythm"],
  },
  {
    id: "established",
    label: "Established",
    focus: "Turn regular reporting into a useful owner decision.",
    nextMove: "Review visibility, compliance workload and the decision ahead.",
    signal: "Visibility in view",
    status: "Review call",
    tasks: ["Management visibility", "Tax position", "Owner priorities"],
  },
  {
    id: "growing",
    label: "Growing",
    focus: "Give a growing business a finance team that keeps pace.",
    nextMove: "Map the capacity question and the reporting needed to answer it.",
    signal: "Capacity in view",
    status: "Planning call",
    tasks: ["Team capacity", "Cash planning", "Growth decisions"],
  },
] as const;

type ScenarioId = (typeof scenarios)[number]["id"];

export function MdFinanceWorkspace() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>(
    scenarios[0].id,
  );
  const activeScenario =
    scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];

  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_35px_100px_-62px_rgb(23_23_23_/_0.55)]"
      data-md-finance-workspace="true"
      data-md-light-workspace="true"
    >
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-black/50">
          MD / finance clarity
        </p>
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#d91f2a]">
          <span className="size-2 rounded-full bg-[#d91f2a]" />
          Concept workspace
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div
          aria-label="Business position"
          className="grid gap-2 sm:grid-cols-3"
          role="group"
        >
          {scenarios.map((scenario) => {
            const isActive = scenario.id === activeScenario.id;

            return (
              <button
                aria-pressed={isActive}
                className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f20b20] ${
                  isActive
                    ? "border-[#d91f2a] bg-[#d91f2a] text-white shadow-[0_10px_30px_-18px_#d91f2a]"
                    : "border-black/10 bg-[#f7f5f1] text-black/62 hover:border-black/20 hover:bg-white hover:text-[#171717]"
                }`}
                key={scenario.id}
                onClick={() => setActiveScenarioId(scenario.id)}
                type="button"
              >
                {scenario.label}
              </button>
            );
          })}
        </div>

        <div
          className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-[#171717] p-5 text-white sm:p-6"
          data-md-finance-signal-rail="true"
        >
          <div
            className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end"
            data-md-finance-signal-content="true"
            key={activeScenario.id}
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-white/52">
                Decision route
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[-.03em]">
                {activeScenario.signal}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ff6670]/55 bg-white/8 px-3 py-1.5 text-xs font-bold text-[#ff8e95]">
              <span className="size-1.5 rounded-full bg-[#d91f2a]" />
              Brief ready to shape
            </span>
          </div>
          <div className="mt-5 grid gap-px overflow-hidden rounded-xl bg-white/15 sm:grid-cols-3">
            <div className="bg-[#171717] p-4">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">
                Position
              </p>
              <p className="mt-2 text-sm font-bold">{activeScenario.label}</p>
            </div>
            <div className="bg-[#171717] p-4">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">
                First call
              </p>
              <p className="mt-2 text-sm font-bold">{activeScenario.status}</p>
            </div>
            <div className="bg-[#171717] p-4">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">
                Records
              </p>
              <p className="mt-2 text-sm font-bold">Only after fit</p>
            </div>
          </div>
        </div>

        <div
          aria-live="polite"
          className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"
          data-md-finance-workspace-panel="true"
        >
          <div
            className="contents"
            data-md-finance-workspace-content="true"
            key={activeScenario.id}
          >
            <div className="rounded-2xl bg-white p-6 text-[#151517] sm:p-7">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#d91f2a]">
                    {activeScenario.status}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold leading-[.95] tracking-[-.05em]">
                    {activeScenario.focus}
                  </h2>
                </div>
                <ArrowUpRight className="size-5 shrink-0 text-[#d91f2a]" />
              </div>
              <div className="mt-9 border-t border-black/10 pt-5">
                <p className="text-[11px] font-black uppercase tracking-[.18em] text-black/42">
                  The first useful move
                </p>
                <p className="mt-2 font-semibold leading-6">
                  {activeScenario.nextMove}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#f7f5f1] p-6 text-[#171717]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-black uppercase tracking-[.18em] text-black/48">
                  Call brief
                </p>
                <CircleAlert className="size-4 text-[#d91f2a]" />
              </div>
              <ul className="mt-6 space-y-4">
                {activeScenario.tasks.map((task) => (
                  <li className="flex items-center gap-3 text-sm font-semibold" key={task}>
                    <Check className="size-4 shrink-0 text-[#d91f2a]" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-black/46">
          Concept workspace · no live records connected
        </p>
      </div>
    </section>
  );
}
