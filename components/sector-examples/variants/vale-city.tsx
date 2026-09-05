import Link from "next/link";
import { ExampleEnquiry } from "../enquiry";
import { PropertyCollection } from "../property-collection";
import { VariantImage, VariantProcess } from "./parts";
export function ValeCityExample() {
  return (
    <>
      <section className="vale-hero">
        <div>
          <p className="example-eyebrow">
            Kent / Homes. People. Possibilities.
          </p>
          <h1>
            FIND THE PLACE.
            <br />
            <span>MAKE THE MOVE.</span>
          </h1>
        </div>
        <div className="vale-hero-bottom">
          <p>
            A sharper search. A clearer sale.
            <br />
            Local property, with the next step in view.
          </p>
          <a className="example-button" href="#services">
            Explore the homes ↓
          </a>
        </div>
        <VariantImage
          priority
          src="/prospect-previews/bespoke/brookbanks/hero-v1.png"
          alt="Illustrative residential property in a Kent neighbourhood"
        />
      </section>
      <div className="vale-paths">
        <Link href="/examples/vale-and-city/buying-a-home">
          I’m buying <span>↗</span>
        </Link>
        <Link href="/examples/vale-and-city/selling-your-home">
          I’m selling <span>↗</span>
        </Link>
        <Link href="/examples/vale-and-city/letting-your-property">
          I’m letting <span>↗</span>
        </Link>
      </div>
      <section className="example-section" id="services">
        <p className="example-eyebrow">A more useful property search</p>
        <h2 className="variant-title">
          Big plans.
          <br />
          Start with a shortlist.
        </h2>
        <PropertyCollection />
      </section>
      <VariantProcess
        title="Make the move with a plan."
        steps={[
          [
            "Define your next move",
            "The location, the timing and the priorities that matter to you.",
          ],
          [
            "Get the useful detail",
            "Clear property information, practical viewing arrangements and answers to your questions.",
          ],
          [
            "Keep moving forward",
            "A named next step and an understanding of what happens after it.",
          ],
        ]}
      />
      <section className="vale-seller example-section" data-reveal>
        <p className="example-eyebrow">Selling? Start with perspective.</p>
        <h2>
          Before the listing.
          <br />
          <span>Let’s get the plan right.</span>
        </h2>
        <p>
          Your timing, your property and an honest conversation about
          presentation. A useful valuation goes further than a number.
        </p>
        <a className="example-button" href="#enquire">
          Plan a valuation call ↗
        </a>
      </section>
      <ExampleEnquiry theme="estate" />
    </>
  );
}
