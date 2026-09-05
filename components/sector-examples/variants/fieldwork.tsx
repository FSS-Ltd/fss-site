import { ExampleEnquiry } from "../enquiry";
import { PropertyCollection } from "../property-collection";
import { VariantImage, VariantProcess } from "./parts";
export function FieldworkExample() {
  return (
    <>
      <section className="fieldwork-hero">
        <div className="fieldwork-hero-copy">
          <p className="example-eyebrow">Homes for a different pace.</p>
          <h1>
            A little closer
            <br />
            to{" "}
            <em>
              the life
              <br />
              you want.
            </em>
          </h1>
          <a href="#services">Find your somewhere ↓</a>
        </div>
        <VariantImage
          priority
          src="/prospect-previews/bespoke/foundation-estate-agents/hero-v1.png"
          alt="Illustrative character home with a garden setting"
        />
        <span className="fieldwork-note">
          The Kent collection / An illustrative home
        </span>
      </section>
      <section className="fieldwork-intro example-section" data-reveal>
        <p className="example-eyebrow">More than a pin on a map</p>
        <h2>
          The walk home.
          <br />
          The view out.
          <br />
          <em>The feeling of belonging.</em>
        </h2>
        <p>
          Some moves begin with a room you need. Others begin with a life you
          imagine. We make space for both, with homes presented for the way
          people actually live.
        </p>
      </section>
      <section className="example-section" id="services">
        <div className="fieldwork-collection-heading">
          <p className="example-eyebrow">Collected with care</p>
          <h2>
            Places with
            <br />
            <em>possibility.</em>
          </h2>
        </div>
        <PropertyCollection />
      </section>
      <section className="fieldwork-note-panel" data-reveal>
        <span aria-hidden="true">✳</span>
        <p>
          A garden for slow mornings.
          <br />A kitchen for long evenings.
          <br />
          <em>A home for what matters.</em>
        </p>
        <a href="#enquire">Tell us what you’re looking for ↗</a>
      </section>
      <VariantProcess
        title="A thoughtful way to move."
        steps={[
          [
            "Begin with your life",
            "Tell us what you want more of, and what you’re ready to leave behind.",
          ],
          [
            "Explore with perspective",
            "Look at the home and its surroundings, with time for the questions that matter.",
          ],
          [
            "Take a considered next step",
            "Plan a viewing or a valuation around your timing and priorities.",
          ],
        ]}
      />
      <ExampleEnquiry theme="estate" />
    </>
  );
}
