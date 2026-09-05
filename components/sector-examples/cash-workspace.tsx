"use client";

import { useState } from "react";

export function CashWorkspace() {
  const [scenario, setScenario] = useState("Steady month");
  const incoming = scenario === "Steady month" ? 18400 : 14200;
  const costs = 12600;
  const remaining = incoming - costs;
  const format = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);
  return (
    <div
      className="folio-workspace"
      aria-label="Illustrative cash planning workspace"
    >
      <div className="folio-workspace-top">
        <span className="folio-appmark">f.</span>
        <span>Your business, at a glance</span>
        <span className="folio-live">Demo</span>
      </div>
      <div className="folio-workspace-body">
        <p className="example-eyebrow">A clearer view / Sample month</p>
        <h3>Room to move.</h3>
        <div className="folio-balance" aria-live="polite">
          {format(remaining)}
          <span>after illustrated operating costs</span>
        </div>
        <div className="folio-chart" aria-hidden="true">
          {[37, 55, 45, 68, 58, 83, scenario === "Steady month" ? 100 : 66].map(
            (height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ),
          )}
        </div>
        <div className="folio-figures">
          <span>
            Money in<strong>{format(incoming)}</strong>
          </span>
          <span>
            Operating costs<strong>{format(costs)}</strong>
          </span>
        </div>
        <fieldset>
          <legend>Explore a different month</legend>
          <div>
            {["Steady month", "Slower month"].map((value) => (
              <button
                type="button"
                aria-pressed={scenario === value}
                key={value}
                onClick={() => setScenario(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="folio-workspace-note">
          Illustrative cash in minus operating costs. Excludes tax, financing
          and other commitments. A demonstration, not a forecast.
        </p>
      </div>
    </div>
  );
}
