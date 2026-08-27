"use client";

import { useState } from "react";

import { ArrowRight, Check, Droplets, MapPinned } from "lucide-react";

import { TradeQuoteSidebar } from "./trade-quote-sidebar";
import { trackPreviewEvent } from "@/lib/prospect-previews/analytics";
import {
  isQuoteRequestReady,
  type QuoteRequestInput,
} from "@/lib/prospect-previews/demo-forms";
import type { TradeProspectPreview } from "@/lib/prospect-previews/types";

const problemOptions = [
  { value: "Leak", detail: "Water where it should not be" },
  { value: "Boiler", detail: "Hot water or boiler issue" },
  { value: "Blocked drain", detail: "Drainage backing up" },
  { value: "No heating", detail: "Heating is not working" },
  { value: "Other", detail: "Something else at the property" },
] as const;

const urgencyOptions = [
  "Emergency today",
  "Within a few days",
  "Planning ahead",
] as const;

type TradeQuoteDemoProps = {
  preview: TradeProspectPreview;
};

const initialRequest: QuoteRequestInput = {
  problem: "",
  postcode: "",
  urgency: "",
  name: "",
  phone: "",
};

export function TradeQuoteDemo({ preview }: TradeQuoteDemoProps) {
  const [request, setRequest] = useState<QuoteRequestInput>(initialRequest);
  const [submitted, setSubmitted] = useState(false);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  function trackStart(): void {
    if (hasTrackedStart) return;

    trackPreviewEvent({
      prospectSlug: preview.slug,
      event: "quote_form_started",
    });
    setHasTrackedStart(true);
  }

  function updateRequest<Key extends keyof QuoteRequestInput>(
    key: Key,
    value: QuoteRequestInput[Key],
  ): void {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  function submitQuoteRequest(): void {
    if (!isQuoteRequestReady(request)) return;

    trackPreviewEvent({
      prospectSlug: preview.slug,
      event: "quote_form_completed",
    });
    setSubmitted(true);
  }

  function resetDemo(): void {
    setRequest(initialRequest);
    setSubmitted(false);
    setHasTrackedStart(false);
  }

  return (
    <section
      aria-labelledby="trade-quote-title"
      className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.9fr)] lg:gap-8"
    >
      <div className="rounded-[2rem] bg-white p-5 shadow-xl shadow-cyan-950/10 ring-1 ring-cyan-950/10 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              Local response demo
            </p>
            <h2
              className="mt-3 text-2xl font-black tracking-[-0.03em] text-cyan-950 sm:text-3xl"
              id="trade-quote-title"
            >
              A better first message gives the team a better first response.
            </h2>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
            <Droplets aria-hidden="true" className="size-6" />
          </span>
        </div>

        {!submitted && (
          <form
            aria-label="Trade quote request demonstration"
            className="mt-8"
            onFocus={trackStart}
            onSubmit={(event) => {
              event.preventDefault();
              submitQuoteRequest();
            }}
          >
            <fieldset>
              <legend className="text-sm font-bold text-cyan-950">
                What do you need help with?
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {problemOptions.map((option) => {
                  const id = `trade-problem-${option.value.toLowerCase().replace(/\s/g, "-")}`;
                  return (
                    <label
                      className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-cyan-950/10 bg-cyan-50/50 px-4 py-3 text-cyan-950 transition hover:border-cyan-950/25 has-checked:border-cyan-700 has-checked:bg-cyan-700 has-checked:text-white"
                      htmlFor={id}
                      key={option.value}
                    >
                      <input
                        checked={request.problem === option.value}
                        className="size-4 accent-lime-300"
                        id={id}
                        name="problem"
                        onChange={() => updateRequest("problem", option.value)}
                        required
                        type="radio"
                        value={option.value}
                      />
                      <span>
                        <span className="block text-sm font-bold">
                          {option.value}
                        </span>
                        <span className="mt-0.5 block text-xs text-cyan-800/70 has-checked:text-white/70">
                          {option.detail}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  className="text-sm font-bold text-cyan-950"
                  htmlFor="trade-postcode"
                >
                  Postcode
                </label>
                <div className="relative mt-2">
                  <MapPinned
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cyan-700"
                  />
                  <input
                    autoComplete="postal-code"
                    className="min-h-12 w-full rounded-xl border border-cyan-950/15 bg-white py-3 pl-10 pr-3 text-sm font-semibold text-cyan-950 outline-none ring-cyan-500 transition placeholder:font-normal focus:ring-4"
                    id="trade-postcode"
                    onChange={(event) =>
                      updateRequest("postcode", event.target.value)
                    }
                    placeholder="e.g. CT14 7AA"
                    required
                    value={request.postcode}
                  />
                </div>
              </div>
              <fieldset>
                <legend className="text-sm font-bold text-cyan-950">
                  How urgent is this?
                </legend>
                <select
                  className="mt-2 min-h-12 w-full rounded-xl border border-cyan-950/15 bg-white px-3 text-sm font-semibold text-cyan-950 outline-none ring-cyan-500 focus:ring-4"
                  id="trade-urgency"
                  onChange={(event) =>
                    updateRequest("urgency", event.target.value)
                  }
                  required
                  value={request.urgency}
                >
                  <option disabled value="">
                    Choose a timeframe
                  </option>
                  {urgencyOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </fieldset>
              <div>
                <label
                  className="text-sm font-bold text-cyan-950"
                  htmlFor="trade-name"
                >
                  Your name
                </label>
                <input
                  autoComplete="name"
                  className="mt-2 min-h-12 w-full rounded-xl border border-cyan-950/15 bg-white px-3 text-sm font-semibold text-cyan-950 outline-none ring-cyan-500 focus:ring-4"
                  id="trade-name"
                  onChange={(event) =>
                    updateRequest("name", event.target.value)
                  }
                  required
                  type="text"
                  value={request.name}
                />
              </div>
              <div>
                <label
                  className="text-sm font-bold text-cyan-950"
                  htmlFor="trade-phone"
                >
                  Best phone number
                </label>
                <input
                  autoComplete="tel"
                  className="mt-2 min-h-12 w-full rounded-xl border border-cyan-950/15 bg-white px-3 text-sm font-semibold text-cyan-950 outline-none ring-cyan-500 focus:ring-4"
                  id="trade-phone"
                  inputMode="tel"
                  onChange={(event) =>
                    updateRequest("phone", event.target.value)
                  }
                  required
                  type="tel"
                  value={request.phone}
                />
              </div>
            </div>

            <button
              className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-4 text-sm font-black text-cyan-950 transition hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
              type="submit"
            >
              Request a response
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
            <p className="mt-4 text-sm leading-6 text-cyan-950/65">
              This is a demonstration only. In a live version, the information
              could be routed to the right person without sending the customer
              through another call.
            </p>
          </form>
        )}

        {submitted && (
          <div aria-live="polite" className="mt-8">
            <div className="rounded-2xl bg-cyan-950 p-6 text-white">
              <span className="grid size-9 place-items-center rounded-full bg-lime-300 text-cyan-950">
                <Check aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 text-xl font-black">
                Your request is ready for the team.
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-100">
                We have not sent this to {preview.businessName}. In a live
                version, it could create a qualified job request and notify the
                right person.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-950/10 bg-cyan-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                Example team summary
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <SummaryItem label="Problem" value={request.problem} />
                <SummaryItem
                  label="Area"
                  value={request.postcode.toUpperCase()}
                />
                <SummaryItem label="Urgency" value={request.urgency} />
              </dl>
            </div>
            <button
              className="mt-6 text-sm font-bold text-cyan-800 underline decoration-cyan-300 decoration-2 underline-offset-4"
              onClick={resetDemo}
              type="button"
            >
              Try the request journey again
            </button>
          </div>
        )}
      </div>

      <TradeQuoteSidebar preview={preview} />
    </section>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
};

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-cyan-950">{value}</dd>
    </div>
  );
}
