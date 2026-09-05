import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
export function Sunday() {
  return (
    <div className="fa-site sunday">
      <section className="sunday-hero">
        <p className="fa-eyebrow">Sunday Garage / For the everyday miles</p>
        <div className="sunday-heading">
          <h1>
            Car care.
            <br />
            <em>Life carries on.</em>
          </h1>
          <p>
            The school run. The weekend away. The ordinary Tuesday. Let’s plan
            the workshop visit around your real life.
          </p>
        </div>
        <div className="sunday-options">
          <a href="#enquire">
            <span>01</span>
            <h2>A routine visit</h2>
            <p>MOT & servicing</p>
            <b aria-hidden="true">↗</b>
          </a>
          <a href="#enquire">
            <span>02</span>
            <h2>Something feels off</h2>
            <p>Diagnosis & repairs</p>
            <b aria-hidden="true">↗</b>
          </a>
          <a href="#enquire">
            <span>03</span>
            <h2>Help me work it out</h2>
            <p>Start with a conversation</p>
            <b aria-hidden="true">↗</b>
          </a>
        </div>
      </section>
      <section className="sunday-photo">
        <VariantImage
          src="/prospect-previews/bespoke/hollis-motors/hero-v1.png"
          alt="Illustrative cars outside an open independent workshop"
          priority
        />
        <div>
          <span className="fa-eyebrow">A useful first step</span>
          <h2>
            Tell us what
            <br />
            you’ve noticed.
          </h2>
          <p>
            No need to translate it into workshop language. Your description
            helps us plan the visit.
          </p>
          <a href="#enquire" className="fa-button">
            Prepare your booking brief ↗
          </a>
        </div>
      </section>
      <VariantServices
        theme="auto"
        slug="sunday-garage"
        title="The essentials, explained."
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
      <ExampleEnquiry theme="auto" />
    </div>
  );
}
