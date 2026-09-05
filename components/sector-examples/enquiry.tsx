"use client";

import { useId, useRef, useState } from "react";
import type { ExampleTheme } from "@/lib/sector-examples/catalog";
import { exampleJourneys } from "@/lib/sector-examples/journeys";

type EnquiryStep = "details" | "review" | "time" | "complete";
const sampleDays = ["Monday", "Wednesday", "Friday"];
const sampleTimes = ["09:30", "11:00", "14:30"];

export function ExampleEnquiry({ theme }: { theme: ExampleTheme }) {
  const journey = exampleJourneys[theme];
  const inputId = useId();
  const [choice, setChoice] = useState(journey.options[0]);
  const [detail, setDetail] = useState(journey.details[0]);
  const [step, setStep] = useState<EnquiryStep>("details");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  function goTo(nextStep: EnquiryStep) {
    setStep(nextStep);
    requestAnimationFrame(() => headingRef.current?.focus());
  }
  const brief = (
    <dl>
      <dt>You’re interested in</dt>
      <dd>{choice}</dd>
      <dt>{journey.detailLabel}</dt>
      <dd>{detail}</dd>
    </dl>
  );
  return (
    <section className="example-enquiry example-section" id="enquire">
      <div data-reveal>
        <p className="example-eyebrow">A useful next step</p>
        <h2>{journey.title}</h2>
        <p>{journey.intro}</p>
        <span className="example-demo-label">
          Try the enquiry journey · No personal details needed
        </span>
      </div>
      <div className="example-enquiry-panel">
        {step === "details" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              goTo("review");
            }}
          >
            <p className="example-eyebrow">01 / A little context</p>
            <h3
              className="example-booking-heading"
              ref={headingRef}
              tabIndex={-1}
            >
              Let’s start with your plans.
            </h3>
            <fieldset>
              <legend>{journey.question}</legend>
              <div className="example-options">
                {journey.options.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={`${inputId}-service`}
                      value={option}
                      checked={choice === option}
                      onChange={() => setChoice(option)}
                    />
                    <span>{option}</span>
                    <span aria-hidden="true">↗</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label
              className="example-select-label"
              htmlFor={`${inputId}-detail`}
            >
              {journey.detailLabel}
            </label>
            <select
              id={`${inputId}-detail`}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            >
              {journey.details.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <button className="example-button" type="submit">
              See my next step <span aria-hidden="true">↗</span>
            </button>
          </form>
        )}
        {step === "review" && (
          <div className="example-review">
            <p className="example-eyebrow">02 / Your conversation brief</p>
            <h3 ref={headingRef} tabIndex={-1}>
              You’re ready for the next step.
            </h3>
            {brief}
            <p>{journey.next}</p>
            <p className="example-demo-label">
              This is a demonstration. No enquiry has been sent and no
              appointment has been booked.
            </p>
            <button
              className="example-button"
              type="button"
              onClick={() => goTo("time")}
            >
              Try a 15-minute call booking <span aria-hidden="true">↗</span>
            </button>
            <button
              className="example-text-button"
              type="button"
              onClick={() => goTo("details")}
            >
              ← Change my answers
            </button>
          </div>
        )}
        {step === "time" && (
          <form
            className="example-booking"
            onSubmit={(event) => {
              event.preventDefault();
              if (day && time) goTo("complete");
            }}
          >
            <p className="example-eyebrow">03 / Explore a sample time</p>
            <h3 ref={headingRef} tabIndex={-1}>
              Make space for a conversation.
            </h3>
            <p id={`${inputId}-sample-note`} className="example-booking-note">
              Choose an illustrative day and time for a 15-minute introductory
              call. These are sample slots, not live availability. Times shown
              are UK local time.
            </p>
            <fieldset aria-describedby={`${inputId}-sample-note`}>
              <legend>Choose a sample day</legend>
              <div className="example-booking-slots">
                {sampleDays.map((slot) => (
                  <label key={slot}>
                    <input
                      required
                      type="radio"
                      name={`${inputId}-day`}
                      value={slot}
                      checked={day === slot}
                      onChange={() => setDay(slot)}
                    />
                    <span>
                      {slot}
                      <small>Sample day</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Choose a sample time</legend>
              <div className="example-booking-slots">
                {sampleTimes.map((slot) => (
                  <label key={slot}>
                    <input
                      required
                      type="radio"
                      name={`${inputId}-time`}
                      value={slot}
                      checked={time === slot}
                      onChange={() => setTime(slot)}
                    />
                    <span>
                      {slot}
                      <small>15 minutes</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="example-button" type="submit">
              Preview my demo appointment <span aria-hidden="true">↗</span>
            </button>
            <button
              className="example-text-button"
              type="button"
              onClick={() => goTo("review")}
            >
              ← Back to my brief
            </button>
          </form>
        )}
        {step === "complete" && (
          <div className="example-review example-booking-complete">
            <p className="example-eyebrow">04 / Your demo appointment</p>
            <h3 ref={headingRef} tabIndex={-1}>
              That’s how easy it could be.
            </h3>
            <div className="example-booking-ticket">
              <span>Sample introductory call</span>
              <strong>
                {day} · {time}
              </strong>
              <span>15 minutes · UK local time</span>
            </div>
            {brief}
            <p className="example-booking-disclaimer">
              Demo complete. No real appointment has been booked, no
              availability has been reserved and no enquiry has been sent.
            </p>
            <p className="example-demo-label">
              A live website would confirm an actual date and collect contact
              details securely. This example does neither.
            </p>
            <button
              className="example-text-button"
              type="button"
              onClick={() => goTo("time")}
            >
              ← Change the sample time
            </button>
            <button
              className="example-text-button"
              type="button"
              onClick={() => goTo("details")}
            >
              Change my answers
            </button>
            <a className="example-button" href="/contact">
              Build this journey for my business ↗
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
