import Image from "next/image";
import { RoofBuildScrollHero } from "@/components/prospect-previews/bespoke/prospects/roof-build-scroll-hero";
import { ExampleEnquiry } from "./enquiry";
import { SectionHeading } from "./chrome";

const services = [
  [
    "01",
    "Repair what matters.",
    "Leaks, slipped tiles and weather damage. Start with the cause, then agree a repair that makes sense.",
    "Roof repairs",
  ],
  [
    "02",
    "Build for the long term.",
    "A considered replacement, from the structure beneath to the finish above. Every layer has a purpose.",
    "New & replacement roofs",
  ],
  [
    "03",
    "Finish every edge.",
    "Flat roofs, leadwork, gutters and roofline details. The small things that help the whole roof perform.",
    "Flat roofs & roofline",
  ],
];

export function RoofingExample() {
  return (
    <>
      <div className="roof-title-band">
        <p className="example-eyebrow">
          Independent roofing / Kent & the South East
        </p>
        <span>
          Built on care.
          <br />
          Made to last.
        </span>
      </div>
      <RoofBuildScrollHero
        accentClassName="text-orange-200"
        assessmentHref="#enquire"
        assessmentLabel="Tell us about your roof ↗"
        businessName="Ridge & Vale"
        eyebrow="Ridge & Vale / The craft of protection"
        heading="Above all, peace of mind."
        summary="From a single slipped tile to a complete new roof. Understand what your home needs, what the work involves and what happens next."
      />
      <div className="roof-spec-strip">
        <span>Survey first</span>
        <span>Clear scope</span>
        <span>Considered materials</span>
        <span>Care from start to finish</span>
      </div>
      <section className="example-section" id="services">
        <SectionHeading number="01" title="Roofing, properly considered">
          <h2>
            A sound roof.
            <br />A simpler decision.
          </h2>
          <p>
            You don’t need to know the name of every tile. You need someone who
            can explain what is happening, and what to do about it.
          </p>
        </SectionHeading>
        <div className="roof-services">
          {services.map(([number, title, description, label]) => (
            <article key={number} data-reveal>
              <span className="example-eyebrow">
                {number} / {label}
              </span>
              <div
                className={`roof-line-art roof-art-${number}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <a href="#enquire">
                Discuss your roof <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="roof-story" id="approach">
        <div className="roof-story-image">
          <Image
            src="/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-v1-poster.jpg"
            alt="Illustrative tiled roof showing the layers of a considered roof restoration"
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </div>
        <div className="roof-story-copy" data-reveal>
          <p className="example-eyebrow">02 / No guesswork overhead</p>
          <h2>
            Good work starts
            <br />
            with a good look.
          </h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Understand the roof</h3>
                <p>
                  Discuss the concern, access and history before arranging an
                  inspection.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Make the work clear</h3>
                <p>
                  See the proposed scope, materials and sequence before
                  deciding.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Know what comes next</h3>
                <p>
                  Agree the practical details, from site access to the final
                  walkthrough.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>
      <section className="example-section example-faq">
        <p className="example-eyebrow">Before we get on the roof</p>
        <details>
          <summary>Do I need a repair or a replacement?</summary>
          <p>
            That depends on the condition and extent of the problem. A survey
            should explain the options rather than assume a replacement is
            needed.
          </p>
        </details>
        <details>
          <summary>What should I prepare for a survey?</summary>
          <p>
            A description of the issue, when you noticed it and any photographs
            taken safely from ground level. Please do not climb onto the roof.
          </p>
        </details>
      </section>
      <ExampleEnquiry theme="roof" />
    </>
  );
}
