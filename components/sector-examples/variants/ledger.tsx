import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
export function Ledger() {
  return (
    <div className="fa-site ledger">
      <section className="ledger-finance-top">
        <p className="fa-eyebrow">Ledger & Co / A business owner’s companion</p>
        <h1>
          Sound advice starts
          <br />
          with a <em>clear picture.</em>
        </h1>
        <div className="ledger-finance-deck">
          <span>Records. Context. Decisions.</span>
          <p>
            Practical accountancy for owners who want to understand their
            business, with the right questions asked and the details explained.
          </p>
        </div>
      </section>
      <section className="ledger-finance-feature">
        <div>
          <p className="fa-eyebrow">The opening conversation</p>
          <h2>
            Bring your questions.
            <br />
            We’ll bring a framework.
          </h2>
          <p>
            What needs to be filed? What needs attention? What would help you
            plan? Start with the issues on your mind, and build the scope around
            your business.
          </p>
          <a href="#enquire" className="fa-button">
            Arrange an introduction ↗
          </a>
        </div>
        <VariantImage
          src="/prospect-previews/bespoke/hilden-park-accountants/hero-v1.png"
          alt="Illustrative meeting table with orderly accounting papers"
          priority
        />
      </section>
      <VariantServices
        theme="accounts"
        slug="ledger-and-co"
        title="A useful reference for running your business."
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
