import type { CSSProperties } from "react";

import { Check } from "lucide-react";

const journeySteps = [
  {
    number: "01",
    title: "Bring the detail together",
    body: "Start with the service, business type and timing rather than an empty message box.",
  },
  {
    number: "02",
    title: "Route it with purpose",
    body: "Organise the request around Compliance, Support or Advising before the first response.",
  },
  {
    number: "03",
    title: "Begin with understanding",
    body: "Give the team a concise brief so the first conversation can focus on what matters.",
  },
] as const;

const lanes = ["Compliance", "Support", "Advising"] as const;

export function WormaldClarityJourney() {
  return (
    <section
      aria-labelledby="wormald-clarity-title"
      className="wormaldClarityJourney"
      data-wormald-clarity-journey="true"
    >
      <div className="wormaldClarityFrame">
        <div className="wormaldClarityLayout">
          <div className="wormaldClarityCopy">
            <p className="wormaldEyebrow">From complex to clear</p>
            <h2 id="wormald-clarity-title">
              A useful conversation starts before the call.
            </h2>
            <div className="wormaldJourneySteps">
              {journeySteps.map((step) => (
                <article key={step.number}>
                  <span>{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div aria-hidden="true" className="wormaldLedgerStage">
            <div className="wormaldLedgerSheets">
              {Array.from({ length: 7 }, (_, index) => (
                <div
                  className="wormaldLedgerSheet"
                  key={index}
                  style={{ "--sheet-index": index } as CSSProperties}
                >
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>

            <div className="wormaldServiceLanes">
              {lanes.map((lane, index) => (
                <div
                  key={lane}
                  style={{ "--lane-index": index } as CSSProperties}
                >
                  <span>0{index + 1}</span>
                  <strong>{lane}</strong>
                </div>
              ))}
            </div>

            <div className="wormaldPreparedBrief">
              <p>Prepared conversation</p>
              <strong>Need · Context · Timing</strong>
              <ul>
                {lanes.map((lane) => (
                  <li key={lane}>
                    <Check size={14} strokeWidth={2.5} />
                    {lane}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
