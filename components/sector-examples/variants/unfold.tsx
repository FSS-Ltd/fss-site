import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
import { FinanceAutoMotion } from "./finance-auto-motion";
export function Unfold() {
  return (
    <div className="fa-site unfold">
      <section className="unfold-hero">
        <VariantImage
          src="/prospect-previews/bespoke/wormald-accountants/hero-ledger-v1.webp"
          alt="Illustrative sculptural layers of paper and glass becoming orderly"
          priority
        />
        <div>
          <p className="fa-eyebrow">Unfold / Accountancy with perspective</p>
          <h1>
            See the business
            <br />
            <em>behind the numbers.</em>
          </h1>
          <p>
            Make sense of where you are.
            <br />
            Find room for where you want to go.
          </p>
          <a href="#enquire" className="fa-button">
            Let’s see what’s possible ↗
          </a>
        </div>
        <span className="unfold-caption">
          A clearer picture changes the conversation.
        </span>
      </section>
      <FinanceAutoMotion kind="unfold" />
      <VariantServices
        theme="accounts"
        slug="unfold-finance"
        title="The foundations of your next chapter."
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
