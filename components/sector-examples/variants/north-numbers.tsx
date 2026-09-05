import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
export function NorthNumbers() {
  return (
    <div className="fa-site north-numbers">
      <section className="north-hero">
        <div>
          <p className="fa-eyebrow">North & Numbers / A little direction</p>
          <h1>
            Your business.
            <br />A little more
            <br />
            <em>understood.</em>
          </h1>
          <p>
            You don’t need to arrive with all the answers. Tell us what’s taking
            up your headspace and we’ll start there.
          </p>
          <a href="#enquire" className="fa-button">
            Find your starting point ↗
          </a>
        </div>
        <div className="north-portrait">
          <VariantImage
            src="/prospect-previews/bespoke/md-accountancy/hero-v1.png"
            alt="Illustrative accounting conversation over a shared notebook"
            priority
          />
          <div className="north-note">
            <span aria-hidden="true">↗</span>
            <p>
              A good first meeting
              <br />
              starts with listening.
            </p>
          </div>
        </div>
      </section>
      <section className="north-prompts">
        <span className="fa-eyebrow">Does this sound familiar?</span>
        <div>
          <a href="#enquire">
            I’m starting something new <span>↗</span>
          </a>
          <a href="#enquire">
            I need the day-to-day sorted <span>↗</span>
          </a>
          <a href="#enquire">
            I want to plan what comes next <span>↗</span>
          </a>
        </div>
      </section>
      <VariantServices
        theme="accounts"
        slug="north-and-numbers"
        title="Support that meets you where you are."
      />
      <VariantProcess
        title="A clear plan. Before we begin."
        steps={[
          [
            "Start with a conversation",
            "Share your priorities and the questions you want answered.",
          ],
          [
            "Agree the work",
            "Understand the scope, timing and costs before committing.",
          ],
          [
            "Keep the next step clear",
            "Review the findings and agree what happens next.",
          ],
        ]}
      />
      <ExampleEnquiry theme="accounts" />
    </div>
  );
}
