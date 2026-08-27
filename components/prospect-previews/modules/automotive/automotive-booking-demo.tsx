"use client";

import { useState } from "react";

import { ArrowRight, CarFront, Check } from "lucide-react";

import { AutomotiveBookingInfo } from "./automotive-booking-info";
import { trackPreviewEvent } from "@/lib/prospect-previews/analytics";
import { normalizeVehicleRegistration } from "@/lib/prospect-previews/demo-forms";
import type { AutomotiveProspectPreview } from "@/lib/prospect-previews/types";

const bookingOptions = ["MOT", "Service", "Repair", "Not sure"] as const;

type BookingOption = (typeof bookingOptions)[number];
type BookingStage = "registration" | "details" | "submitted";

type AutomotiveBookingDemoProps = {
  preview: AutomotiveProspectPreview;
};

export function AutomotiveBookingDemo({ preview }: AutomotiveBookingDemoProps) {
  const [stage, setStage] = useState<BookingStage>("registration");
  const [registration, setRegistration] = useState("");
  const [bookingType, setBookingType] = useState<BookingOption>("MOT");
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  function trackStart(): void {
    if (hasTrackedStart) return;

    trackPreviewEvent({
      prospectSlug: preview.slug,
      event: "mot_form_started",
    });
    setHasTrackedStart(true);
  }

  function continueToDetails(): void {
    if (!registration) return;
    trackStart();
    setStage("details");
  }

  function submitBooking(): void {
    trackPreviewEvent({
      prospectSlug: preview.slug,
      event: "mot_form_completed",
    });
    setStage("submitted");
  }

  function startAgain(): void {
    setRegistration("");
    setBookingType("MOT");
    setHasTrackedStart(false);
    setStage("registration");
  }

  return (
    <section
      aria-labelledby="automotive-booking-title"
      className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)] lg:gap-8"
    >
      <div className="rounded-[2rem] bg-[#111827] p-5 text-white shadow-2xl shadow-slate-950/20 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
              Online booking demo
            </p>
            <h2
              id="automotive-booking-title"
              className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Book the job while it is still on their mind.
            </h2>
          </div>
          <CarFront
            aria-hidden="true"
            className="size-9 shrink-0 text-orange-300"
          />
        </div>

        {stage === "registration" && (
          <form
            aria-label="MOT booking demonstration"
            className="mt-8"
            onFocus={trackStart}
            onSubmit={(event) => {
              event.preventDefault();
              continueToDetails();
            }}
          >
            <label
              className="text-sm font-semibold text-slate-100"
              htmlFor="vehicle-registration"
            >
              Vehicle registration
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                autoCapitalize="characters"
                className="min-h-14 w-full rounded-xl border border-white/15 bg-white px-4 text-xl font-bold uppercase tracking-[0.12em] text-slate-950 outline-none ring-orange-300 transition placeholder:normal-case placeholder:tracking-normal focus:ring-4"
                id="vehicle-registration"
                inputMode="text"
                maxLength={12}
                onChange={(event) =>
                  setRegistration(
                    normalizeVehicleRegistration(event.target.value),
                  )
                }
                placeholder="AB12 CDE"
                required
                value={registration}
              />
              <button
                className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-orange-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
                type="submit"
              >
                Check availability
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
              This is a demonstration only. In a live version, the registration
              could guide the booking and give the workshop the details it
              needs.
            </p>
          </form>
        )}

        {stage === "details" && (
          <form
            aria-label="Vehicle enquiry details demonstration"
            className="mt-8"
            onSubmit={(event) => {
              event.preventDefault();
              submitBooking();
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Vehicle
                </p>
                <p className="mt-1 text-xl font-bold tracking-[0.12em] text-orange-300">
                  {registration}
                </p>
              </div>
              <button
                className="text-sm font-semibold text-slate-300 underline decoration-slate-500 underline-offset-4 transition hover:text-white"
                onClick={() => setStage("registration")}
                type="button"
              >
                Change
              </button>
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-slate-100">
                What do you need?
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {bookingOptions.map((option) => {
                  const id = `booking-type-${option.toLowerCase().replace(/\s/g, "-")}`;
                  return (
                    <label
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold transition has-checked:border-orange-300 has-checked:bg-orange-300 has-checked:text-slate-950"
                      htmlFor={id}
                      key={option}
                    >
                      <input
                        checked={bookingType === option}
                        className="size-4 accent-slate-950"
                        id={id}
                        name="booking-type"
                        onChange={() => setBookingType(option)}
                        type="radio"
                        value={option}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="text-sm font-semibold text-slate-100"
                  htmlFor="preferred-date"
                >
                  Preferred date
                </label>
                <input
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none ring-orange-300 focus:ring-4 [color-scheme:dark]"
                  id="preferred-date"
                  name="preferred-date"
                  type="date"
                />
              </div>
              <div>
                <label
                  className="text-sm font-semibold text-slate-100"
                  htmlFor="preferred-time"
                >
                  Preferred time
                </label>
                <select
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none ring-orange-300 focus:ring-4"
                  defaultValue=""
                  id="preferred-time"
                  name="preferred-time"
                >
                  <option disabled value="">
                    Choose a time
                  </option>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Any time</option>
                </select>
              </div>
              <div>
                <label
                  className="text-sm font-semibold text-slate-100"
                  htmlFor="customer-name"
                >
                  Name
                </label>
                <input
                  autoComplete="name"
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none ring-orange-300 focus:ring-4"
                  id="customer-name"
                  name="customer-name"
                  required
                  type="text"
                />
              </div>
              <div>
                <label
                  className="text-sm font-semibold text-slate-100"
                  htmlFor="customer-phone"
                >
                  Phone
                </label>
                <input
                  autoComplete="tel"
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none ring-orange-300 focus:ring-4"
                  id="customer-phone"
                  inputMode="tel"
                  name="customer-phone"
                  required
                  type="tel"
                />
              </div>
            </div>

            <button
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-orange-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
              type="submit"
            >
              Request booking
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </form>
        )}

        {stage === "submitted" && (
          <div aria-live="polite" className="mt-8">
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-300 p-5 text-emerald-950">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-950 text-emerald-100">
                <Check aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-bold">
                  Thanks. Your booking request is in.
                </h3>
                <p className="mt-1 text-sm leading-6">
                  In a live version, this enquiry could notify the team and
                  appear in the business dashboard straight away.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
                Example team view
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-slate-400">Vehicle</dt>
                  <dd className="mt-1 font-bold tracking-[0.1em] text-white">
                    {registration}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Request</dt>
                  <dd className="mt-1 font-bold text-white">{bookingType}</dd>
                </div>
              </dl>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-bold text-white transition hover:bg-white/10"
                  type="button"
                >
                  Call customer
                </button>
                <button
                  className="min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-orange-100"
                  type="button"
                >
                  Confirm booking
                </button>
              </div>
            </div>

            <button
              className="mt-6 text-sm font-semibold text-slate-300 underline decoration-slate-500 underline-offset-4 transition hover:text-white"
              onClick={startAgain}
              type="button"
            >
              Try the booking journey again
            </button>
          </div>
        )}
      </div>

      <AutomotiveBookingInfo preview={preview} />
    </section>
  );
}
