import Link from "next/link";
import { VariantImage } from "../../variants/parts";
import { CollectionEnd, gardenImage } from "./parts";
export function RootFormExample() {
  return (
    <div className="hl-site hl-root">
      <section className="hl-root-hero">
        <div>
          <p className="hl-kicker">Root & Form / Garden design in Kent</p>
          <h1>
            A better garden
            <br />
            begins with
            <br />
            <em>a clear plan.</em>
          </h1>
          <p>
            Landscape design, planting and practical guidance. Understand the
            possibilities for your space and the steps to bring them to life.
          </p>
          <a className="hl-button" href="#enquire">
            Discuss your garden ↗
          </a>
        </div>
        <figure>
          <VariantImage
            priority
            src={gardenImage}
            alt="Illustrative garden design study with a detailed planting plan"
          />
          <figcaption>01 / From drawing to a living place</figcaption>
        </figure>
      </section>
      <section className="hl-root-guide" data-reveal>
        <div>
          <p className="hl-kicker">Before the first sketch</p>
          <h2>
            Good questions.
            <br />
            <em>Better foundations.</em>
          </h2>
          <Link href="/examples/root-form/garden-design">
            Read the garden design guide ↗
          </Link>
        </div>
        <ol>
          <li>
            <span>01</span>
            <h3>What do you want the garden to do?</h3>
            <p>
              Space to gather, a quieter outlook, room to grow. Begin with life,
              then layout.
            </p>
          </li>
          <li>
            <span>02</span>
            <h3>What does the site need?</h3>
            <p>
              Light, levels, drainage, access and existing planting inform the
              design.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>What belongs in the first phase?</h3>
            <p>
              A realistic scope and working budget help put decisions in the
              right order.
            </p>
          </li>
        </ol>
      </section>
      <CollectionEnd theme="landscape" slug="root-form" />
    </div>
  );
}
