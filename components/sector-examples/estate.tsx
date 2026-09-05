import { PropertyWalkthroughHero } from "@/components/prospect-previews/bespoke/prospects/property-walkthrough-hero";
import { ExampleEnquiry } from "./enquiry";
import { SectionHeading } from "./chrome";
import { PropertyCollection } from "./property-collection";

export function EstateExample() {
  return (
    <>
      <PropertyWalkthroughHero
        accentClassName="text-amber-100"
        actionHref="#services"
        actionLabel="Find your kind of home"
        description="Homes with character. Advice with perspective. A thoughtful way to buy, sell and settle into somewhere new."
        eyebrow="Independent estate agency / Kent"
        heading="A place for your next chapter."
        journeyBeats={[
          {
            eyebrow: "Beyond the front door",
            heading: "Room for the everyday.",
            description:
              "The morning light. The space around the table. The small details that make a house feel like yours.",
          },
          {
            eyebrow: "A move, considered",
            heading: "Let’s open the right doors.",
            description:
              "Start with what matters to you. Find a home, explore a valuation or talk through a move without the pressure.",
          },
        ]}
        placeLabel="Hearth & Acre / An illustrative home"
      />
      <section className="estate-intro example-section" id="approach">
        <p className="example-eyebrow">A little local perspective</p>
        <h2 data-reveal>
          Property is personal.
          <br />
          <em>So are we.</em>
        </h2>
        <div>
          <p>
            A good move begins with being understood. What you love about where
            you live. What you need from what comes next. And the questions you
            haven’t quite worked out how to ask.
          </p>
          <a className="example-text-link" href="#enquire">
            Tell us your story ↗
          </a>
        </div>
      </section>
      <section className="example-section estate-listings" id="services">
        <SectionHeading number="01" title="The collection">
          <h2>
            Somewhere that
            <br />
            <em>feels like you.</em>
          </h2>
        </SectionHeading>
        <PropertyCollection />
      </section>
      <section className="estate-seller" data-reveal>
        <p className="example-eyebrow">For the place you’re leaving</p>
        <h2>
          Your home has a story.
          <br />
          <em>Let’s tell it properly.</em>
        </h2>
        <p>
          Considered photography, thoughtful presentation and a clear plan for
          your sale. Begin with a conversation about your home and the move you
          want to make.
        </p>
        <a className="example-button" href="#enquire">
          Explore a home valuation ↗
        </a>
        <div className="estate-seller-steps">
          <span>01 / Understand your home</span>
          <span>02 / Shape the story</span>
          <span>03 / Manage the move</span>
        </div>
      </section>
      <section className="example-section example-faq">
        <p className="example-eyebrow">A few things you might be wondering</p>
        <details>
          <summary>Can I talk about selling before I’m ready to move?</summary>
          <p>
            Yes. An early conversation can help you understand preparation,
            timing and the questions to ask before committing to a sale.
          </p>
        </details>
        <details>
          <summary>How would a valuation work?</summary>
          <p>
            An agent would arrange a visit, discuss comparable homes and your
            plans, and explain the proposed marketing and fees before you
            instruct them.
          </p>
        </details>
      </section>
      <ExampleEnquiry theme="estate" />
    </>
  );
}
