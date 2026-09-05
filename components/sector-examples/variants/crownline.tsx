import Link from "next/link";
import { ExampleEnquiry } from "../enquiry";
import {
  VariantImage,
  VariantServices,
  VariantProcess,
  VariantQuestion,
} from "./parts";
export function CrownlineExample() {
  return (
    <>
      <section className="crown-hero">
        <div>
          <p className="example-eyebrow">
            Kent roofing / Practical answers, from the start
          </p>
          <h1>
            A ROOFING
            <br />
            PROBLEM?
            <br />
            <span>START HERE.</span>
          </h1>
          <p>
            Find out what your roof needs. Understand the options. Arrange a
            survey with the right questions already answered.
          </p>
          <a href="#enquire" className="example-button">
            Let’s look at your roof ↗
          </a>
        </div>
        <div className="crown-hero-right">
          <VariantImage
            priority
            src="/prospect-previews/bespoke/bridgland-roofing/hero-wide-v1.png"
            alt="Illustrative roof construction and roofline detail"
          />
          <div className="crown-quick">
            <p className="example-eyebrow">What have you noticed?</p>
            <Link href="/examples/crownline-roofing/roof-repairs">
              A leak or damaged tiles <span>↗</span>
            </Link>
            <Link href="/examples/crownline-roofing/new-roofs">
              An ageing roof <span>↗</span>
            </Link>
            <Link href="/examples/crownline-roofing/flat-roofs">
              A flat-roof concern <span>↗</span>
            </Link>
          </div>
        </div>
      </section>
      <div className="crown-strip">
        <strong>LESS GUESSWORK.</strong>
        <span>Service guides that explain the work.</span>
        <span>A survey before a specification.</span>
      </div>
      <VariantServices
        theme="roof"
        slug="crownline-roofing"
        title="Straight answers. Solid work."
      />
      <VariantQuestion
        question="A repair, or a whole new roof?"
        answer="Start with an assessment of the problem. A damaged tile, failed junction and worn covering can need very different responses. The right recommendation should explain the finding, the options and why the proposed work makes sense."
      />
      <VariantProcess
        title="Know where you stand."
        steps={[
          [
            "Tell us what you’ve seen",
            "A short description and the history of the problem give the survey a useful starting point.",
          ],
          [
            "Get a clear assessment",
            "Discuss the condition, access and any further checks before agreeing a scope.",
          ],
          [
            "Decide with the details",
            "Review the proposed work and cost, then choose the right time to proceed.",
          ],
        ]}
      />
      <ExampleEnquiry theme="roof" />
    </>
  );
}
