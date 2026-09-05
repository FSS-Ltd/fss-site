import Link from "next/link";
import { VariantImage } from "../../variants/parts";
import { plumbingImage, TradeDetails, TradeLink } from "./parts";
import { ScrollStory } from "./scroll-story";

export function Stillwater() {
  return (
    <div className="trade-site stillwater">
      <section className="stillwater-hero">
        <VariantImage
          src={plumbingImage}
          alt="Illustrative cutaway of copper pipework within a calm modern kitchen"
          priority
        />
        <div className="stillwater-copy">
          <p className="trade-kicker">Stillwater / Plumbing & heating</p>
          <h1>
            The quiet comfort
            <br />
            of a home
            <br />
            <em>that works.</em>
          </h1>
          <p>
            Water where it belongs. Warmth when you need it. Thoughtful care for
            the systems you live with.
          </p>
          <TradeLink>Find your flow</TradeLink>
        </div>
        <span className="stillwater-caption">
          Beneath the surface / A better everyday
        </span>
      </section>
      <section className="trade-intro">
        <p className="trade-kicker">The unseen essentials</p>
        <h2>
          A thousand small moments.
          <br />
          One well-cared-for home.
        </h2>
        <p>
          From the first shower to the last turn of a tap, a comfortable home
          depends on details. We start by understanding yours.
        </p>
      </section>
      <ScrollStory kind="water" />
      <TradeDetails theme="plumbing" slug="stillwater" />
    </div>
  );
}

export function CopperField() {
  return (
    <div className="trade-site copper-field">
      <section className="copper-masthead">
        <p className="trade-kicker">Copper & Field / The home care journal</p>
        <div>
          <h1>
            Good answers.
            <br />
            <em>Sound plumbing.</em>
          </h1>
          <p>
            Practical guidance for the things a home asks of you. Repairs,
            heating and drainage, explained before the work begins.
          </p>
        </div>
      </section>
      <section className="copper-feature">
        <div>
          <span className="trade-kicker">Field note / 001</span>
          <h2>
            A damp patch is a clue.
            <br />
            Start with the cause.
          </h2>
          <p>
            Where water appears is not always where it starts. Describe when you
            first noticed the problem and how it changes. A proper assessment
            comes before a repair plan.
          </p>
          <Link
            className="trade-action"
            href="/examples/copper-field/leaks-and-repairs"
          >
            Read the repair guide <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <VariantImage
          src={plumbingImage}
          alt="Illustrative exposed copper pipework beside a kitchen sink"
          priority
        />
        <aside>
          <span>In this guide</span>
          <p>01 / Leaks & repairs</p>
          <p>02 / Heating care</p>
          <p>03 / Drainage</p>
          <TradeLink>Discuss your home</TradeLink>
        </aside>
      </section>
      <TradeDetails theme="plumbing" slug="copper-field" />
    </div>
  );
}

export function Warmform() {
  return (
    <div className="trade-site warmform">
      <section className="warmform-hero">
        <div className="warmform-title">
          <p className="trade-kicker">Warmform / Water. Warmth. Wellbeing.</p>
          <h1>
            Comfort,
            <br />
            <em>considered.</em>
          </h1>
          <p>Plumbing and heating, with care for the way you live.</p>
          <TradeLink>Make yourself at home</TradeLink>
        </div>
        <div className="warmform-orbit" aria-hidden="true">
          <span>W</span>
          <i />
        </div>
        <VariantImage
          src={plumbingImage}
          alt="Illustrative modern kitchen with carefully routed copper plumbing"
          priority
        />
        <span className="warmform-note">
          A home is a feeling.
          <br />
          We look after what makes it possible.
        </span>
      </section>
      <section className="warmform-manifesto">
        <span className="trade-kicker">Our point of view</span>
        <h2>
          Good plumbing should be felt
          <br />
          <em>in the ease of your day.</em>
        </h2>
        <p>
          The right temperature. The reassuring turn of a tap. Work planned
          around your home, with the details explained and the next step clear.
        </p>
      </section>
      <TradeDetails theme="plumbing" slug="warmform" />
    </div>
  );
}

export function Flowline() {
  return (
    <div className="trade-site flowline">
      <section className="flowline-hero">
        <div>
          <p className="trade-kicker">Flowline / A clear way forward</p>
          <h1>
            Let’s get your
            <br />
            home flowing
            <br />
            <em>again.</em>
          </h1>
          <p>
            A leak to investigate? Heating to plan? Start with what you know.
            We’ll help shape the next step.
          </p>
          <TradeLink>Build your visit brief</TradeLink>
          <p className="trade-small">
            Explain the issue → Agree the scope → Arrange a visit
          </p>
        </div>
        <div className="flowline-board">
          <span className="trade-kicker">What needs attention?</span>
          <Link href="/examples/flowline/leaks-and-repairs">
            <b>01</b>
            <span>
              A leak or repair<small>Taps, pipework and fixtures</small>
            </span>
            ↗
          </Link>
          <Link href="/examples/flowline/heating-care">
            <b>02</b>
            <span>
              Heating & hot water<small>Comfort and planned care</small>
            </span>
            ↗
          </Link>
          <Link href="/examples/flowline/drainage">
            <b>03</b>
            <span>
              Slow or blocked drains
              <small>Understand the underlying cause</small>
            </span>
            ↗
          </Link>
          <VariantImage
            src={plumbingImage}
            alt="Illustrative kitchen plumbing detail"
            priority
          />
        </div>
      </section>
      <TradeDetails theme="plumbing" slug="flowline" />
    </div>
  );
}
