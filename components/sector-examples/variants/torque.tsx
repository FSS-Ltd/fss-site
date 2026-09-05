import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
import { FinanceAutoMotion } from "./finance-auto-motion";
export function Torque() {
  return (
    <div className="fa-site torque">
      <section className="torque-hero">
        <VariantImage
          src="/prospect-previews/bespoke/archway-automotive/hero-v1.png"
          alt="Illustrative mechanic assessing a wheel in a workshop"
          priority
        />
        <div>
          <p className="fa-eyebrow">Torque / The details drive us</p>
          <h1>
            EVERY DETAIL.
            <br />
            <em>BACK IN</em>
            <br />
            MOTION.
          </h1>
          <p>
            Listen to the car. Understand the cause.
            <br />
            Make the next move count.
          </p>
          <a href="#enquire" className="fa-button">
            Talk to the workshop ↗
          </a>
        </div>
        <span className="torque-marker">
          01 / Observation → 02 / Diagnosis → 03 / Repair
        </span>
      </section>
      <FinanceAutoMotion kind="torque" />
      <VariantServices
        theme="auto"
        slug="torque-workshop"
        title="Care for every part of the journey."
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
