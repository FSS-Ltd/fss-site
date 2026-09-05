import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
export function Vantage() {
  return (
    <div className="fa-site vantage">
      <section className="vantage-intro">
        <p className="fa-eyebrow">
          Vantage Motor Co. / The considered workshop
        </p>
        <h1>
          For the cars
          <br />
          you choose <em>to keep.</em>
        </h1>
        <div>
          <p>
            Good ownership is a long conversation.
            <br />
            We take time to understand the car, its history and the way you
            drive.
          </p>
          <a href="#enquire" className="fa-button">
            Introduce your car ↗
          </a>
        </div>
      </section>
      <section className="vantage-frame">
        <VariantImage
          src="/prospect-previews/bespoke/hazel-motors/hero-v1.png"
          alt="Illustrative technician inspecting a car in a carefully organised workshop"
          priority
        />
        <span>Care, considered / The workshop journal</span>
      </section>
      <section className="vantage-essay">
        <p className="fa-eyebrow">A longer view</p>
        <h2>
          Maintenance is part
          <br />
          of the relationship.
        </h2>
        <p>
          The service history, the miles you cover and the changes you notice
          all tell a story. Bring that context to the workshop so the work can
          be planned around the car you actually drive.
        </p>
      </section>
      <VariantServices
        theme="auto"
        slug="vantage-motor-co"
        title="Thoughtful attention. From bonnet to road."
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
