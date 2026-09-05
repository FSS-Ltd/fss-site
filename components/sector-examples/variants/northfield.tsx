import { ExampleEnquiry } from "../enquiry";
import {
  VariantImage,
  VariantServices,
  VariantProcess,
  VariantQuestion,
} from "./parts";
export function NorthfieldExample() {
  return (
    <>
      <section className="northfield-hero">
        <div>
          <p className="example-eyebrow">
            A local approach to roof care / Kent
          </p>
          <h1>
            Home feels better
            <br />
            with a <em>good roof.</em>
          </h1>
          <p>
            A leak you’ve just noticed. Repairs you’ve been putting off. Plans
            for something new. Let’s make the next step a little easier.
          </p>
          <a className="example-button" href="#enquire">
            Arrange a roof conversation ↗
          </a>
          <div className="northfield-checks">
            <span>✓ Plain-English explanations</span>
            <span>✓ A clear plan before work</span>
          </div>
        </div>
        <VariantImage
          priority
          src="/prospect-previews/bespoke/jrb-roofing/hero-v1.png"
          alt="Illustrative residential roof and home in a leafy neighbourhood"
        />
      </section>
      <section className="northfield-start" data-reveal>
        <div>
          <p className="example-eyebrow">
            You don’t have to know the answer yet
          </p>
          <h2>
            Tell us what’s happening.
            <br />
            We’ll start there.
          </h2>
        </div>
        <a className="example-button" href="#enquire">
          Find my next step ↗
        </a>
      </section>
      <VariantServices
        theme="roof"
        slug="northfield-roofing"
        title="Looking after the roof above you."
      />
      <VariantProcess
        title="Simple steps. Less worry."
        steps={[
          [
            "A little context",
            "Tell us about the property and the concern. No roofing vocabulary required.",
          ],
          [
            "A useful conversation",
            "Discuss what needs checking and how a survey would work.",
          ],
          [
            "A plan you understand",
            "Know what is proposed, what is included and what happens next.",
          ],
        ]}
      />
      <VariantQuestion
        question="Not sure if it needs looking at?"
        answer="Start by describing the change you’ve noticed. Photos from ground level and a little history are useful. Leave roof access and close inspection to a professional."
      />
      <ExampleEnquiry theme="roof" />
    </>
  );
}
