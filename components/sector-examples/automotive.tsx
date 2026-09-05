import Image from "next/image";
import { ExampleEnquiry } from "./enquiry";
import { SectionHeading } from "./chrome";

export function AutomotiveExample() {
  return (
    <>
      <section className="auto-hero">
        <div className="auto-hero-copy">
          <p className="example-eyebrow">Independent workshop / Kent</p>
          <h1>
            GOOD HANDS.
            <br />
            CLEAR ANSWERS.
            <br />
            <span>OPEN ROAD.</span>
          </h1>
          <div className="auto-hero-bottom">
            <p>
              For the car you rely on.
              <br />
              Servicing, diagnostics and repairs
              <br />
              with a clear plan before the work begins.
            </p>
            <a href="#enquire" className="example-button">
              Plan a workshop visit ↗
            </a>
          </div>
        </div>
        <div className="auto-hero-image">
          <Image
            src="/prospect-previews/bespoke/hollis-motors/hero-v1.png"
            alt="Illustrative independent workshop with a car ready for servicing"
            fill
            priority
            sizes="100vw"
          />
          <span className="auto-image-caption">APEX / KEEP LIFE MOVING</span>
          <div className="auto-crosshair" aria-hidden="true" />
        </div>
      </section>
      <div className="auto-ticker" aria-hidden="true">
        <span>PRECISION IN THE WORK.</span>
        <span>CLARITY IN THE CONVERSATION.</span>
        <span>PRECISION IN THE WORK.</span>
      </div>
      <section className="example-section" id="services">
        <SectionHeading number="01" title="Under the bonnet">
          <h2>
            Whatever the reason.
            <br />
            <span>Start with the right check.</span>
          </h2>
        </SectionHeading>
        <div className="auto-service-list">
          {[
            [
              "01",
              "MOT & servicing",
              "Keep the essentials in order.",
              "Routine maintenance, service schedules and preparation for the road ahead.",
            ],
            [
              "02",
              "Diagnostics",
              "Find the cause. Then the fix.",
              "Warning lights and unfamiliar noises deserve a proper investigation before replacing parts.",
            ],
            [
              "03",
              "Repairs & wear",
              "Put confidence back in the drive.",
              "Brakes, tyres, suspension and the components that make everyday driving feel right.",
            ],
          ].map(([n, name, title, description]) => (
            <article key={n} data-reveal>
              <span className="example-eyebrow">/{n}</span>
              <h3>{name}</h3>
              <div>
                <h4>{title}</h4>
                <p>{description}</p>
              </div>
              <a href="#enquire" aria-label={`Discuss ${name}`}>
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="auto-process example-section" id="approach">
        <div data-reveal>
          <p className="example-eyebrow">02 / No surprises under the bonnet</p>
          <h2>
            YOU’RE IN
            <br />
            <span>THE LOOP.</span>
          </h2>
          <p>
            Hand over the keys.
            <br />
            Keep control of the decisions.
          </p>
        </div>
        <ol>
          {[
            [
              "Tell us what’s changed",
              "The car, the symptoms and when they started. A useful brief helps the workshop prepare.",
            ],
            [
              "Understand the diagnosis",
              "A clear explanation of the finding and the proposed work, with the cost discussed first.",
            ],
            [
              "Agree the work",
              "Make an informed decision before repairs begin. Know what is being done and why.",
            ],
          ].map(([title, body], index) => (
            <li key={title} data-reveal>
              <span>0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="example-section example-faq">
        <p className="example-eyebrow">Before your visit</p>
        <details>
          <summary>What if I don’t know what’s wrong?</summary>
          <p>
            Describe the sound, warning or change you’ve noticed. You don’t need
            to diagnose it yourself. The workshop can explain the next
            diagnostic step.
          </p>
        </details>
        <details>
          <summary>Will repairs start without asking me?</summary>
          <p>
            This example is built around approval before work: an explanation, a
            proposed scope and an agreed cost before repairs begin.
          </p>
        </details>
      </section>
      <ExampleEnquiry theme="auto" />
    </>
  );
}
