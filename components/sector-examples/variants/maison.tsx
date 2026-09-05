import Link from "next/link";
import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantProcess } from "./parts";
export function MaisonExample() {
  return (
    <>
      <section className="maison-hero">
        <div>
          <p className="example-eyebrow">Maison / The considered move</p>
          <h1>
            Your next
            <br />
            <em>address.</em>
          </h1>
          <p>
            A clear perspective on the home you have.
            <br />A thoughtful approach to the move ahead.
          </p>
          <a href="#enquire" className="example-button">
            Begin with a valuation call ↗
          </a>
        </div>
        <VariantImage
          priority
          src="/prospect-previews/bespoke/jenkinson-estates/hero-v1.png"
          alt="Illustrative elegant property exterior and architectural details"
        />
        <span className="maison-vertical">PROPERTY, WITH PERSPECTIVE</span>
      </section>
      <section className="maison-intro example-section" data-reveal>
        <span>01</span>
        <h2>
          Not just a valuation.
          <br />
          <em>A direction.</em>
        </h2>
        <p>
          Before a photograph is taken or a listing is written, there is a
          conversation. About your home, your priorities and the move you want
          to make. That is where we begin.
        </p>
      </section>
      <section className="maison-services example-section" id="services">
        <p className="example-eyebrow">Three ways forward</p>
        {[
          [
            "selling-your-home",
            "A considered sale",
            "Present the home clearly. Plan the move carefully.",
          ],
          [
            "buying-a-home",
            "A new beginning",
            "A useful viewing starts with what you’re looking for.",
          ],
          [
            "letting-your-property",
            "A property in good hands",
            "Understand the service and the responsibilities.",
          ],
        ].map(([slug, title, body], index) => (
          <Link
            key={slug}
            href={`/examples/maison-property/${slug}`}
            data-reveal
          >
            <span>0{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
            <span>↗</span>
          </Link>
        ))}
      </section>
      <VariantProcess
        title="A move that starts with you."
        steps={[
          [
            "Your introduction",
            "Tell us where you are in the decision and what you need to understand.",
          ],
          [
            "Your property conversation",
            "Discuss the home, comparable properties and the plan for presenting it.",
          ],
          [
            "Your next step",
            "Choose the timing with the process, scope and fees made clear.",
          ],
        ]}
      />
      <ExampleEnquiry theme="estate" />
    </>
  );
}
