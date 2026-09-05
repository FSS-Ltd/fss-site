import Link from "next/link";
import { VariantImage } from "../../variants/parts";
import { electricalImage, TradeDetails, TradeLink } from "./parts";
import { ScrollStory } from "./scroll-story";

export function LumenWorks() {
  return (
    <div className="trade-site lumen-works">
      <section className="lumen-hero">
        <div className="lumen-light" aria-hidden="true" />
        <p className="trade-kicker">
          Lumen Works / Electrical, thoughtfully done
        </p>
        <h1>
          Life happens
          <br />
          in the <em>right light.</em>
        </h1>
        <div className="lumen-bottom">
          <p>
            Behind every useful space is a network of considered decisions.
            Let’s make yours work beautifully.
          </p>
          <TradeLink>Bring your plans to light</TradeLink>
        </div>
        <VariantImage
          src={electricalImage}
          alt="Illustrative electrician inspecting a consumer unit in a modern interior"
          priority
        />
      </section>
      <section className="trade-intro">
        <p className="trade-kicker">From first thought to final switch</p>
        <h2>
          Small details.
          <br />A different feeling.
        </h2>
        <p>
          From a troublesome circuit to a carefully planned renovation,
          understand the installation before deciding what comes next.
        </p>
      </section>
      <ScrollStory kind="light" />
      <TradeDetails theme="electrical" slug="lumen-works" />
    </div>
  );
}

export function CircuitLedger() {
  return (
    <div className="trade-site circuit-ledger">
      <section className="ledger-hero">
        <div className="ledger-index">
          <span className="trade-kicker">Circuit Ledger</span>
          <p>
            Knowledge before work.
            <br />
            Clarity before commitment.
          </p>
          <span className="ledger-symbol" aria-hidden="true">
            ↳
          </span>
        </div>
        <div>
          <p className="trade-kicker">
            The electrical reference / For your property
          </p>
          <h1>
            Know what’s
            <br />
            behind
            <br />
            <em>the switch.</em>
          </h1>
          <p>
            Electrical work is easier to navigate when the scope, findings and
            next steps make sense.
          </p>
          <TradeLink>Talk through your project</TradeLink>
        </div>
      </section>
      <section className="ledger-article">
        <VariantImage
          src={electricalImage}
          alt="Illustrative professional electrical inspection"
          priority
        />
        <div>
          <span className="trade-kicker">Start here / Inspection notes</span>
          <h2>
            A report should lead
            <br />
            to understanding.
          </h2>
          <p>
            Ask what was inspected, what could not be accessed and which
            findings need attention. A useful handover gives you a clear picture
            of your installation and the work being recommended.
          </p>
          <Link
            className="trade-action"
            href="/examples/circuit-ledger/electrical-inspections"
          >
            Explore inspections <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <TradeDetails theme="electrical" slug="circuit-ledger" />
    </div>
  );
}

export function PhaseStudio() {
  return (
    <div className="trade-site phase-studio">
      <section className="phase-hero">
        <p className="trade-kicker">
          Phase Studio / Electrical design & installation
        </p>
        <h1>
          POWER.
          <br />
          <span>WITH</span>
          <br />
          PURPOSE.
        </h1>
        <div className="phase-disc" aria-hidden="true">
          ↗
        </div>
        <div className="phase-caption">
          <p>
            Spaces for living.
            <br />
            Circuits for everything
            <br />
            that happens in them.
          </p>
          <TradeLink>Start a project</TradeLink>
        </div>
      </section>
      <section className="phase-project">
        <div>
          <span className="trade-kicker">The studio approach / 01</span>
          <h2>
            Design the day.
            <br />
            Then the details.
          </h2>
          <p>
            Where you read. How you cook. The light you want to come home to.
            Tell us how the room will work, and the electrical brief can follow.
          </p>
        </div>
        <VariantImage
          src={electricalImage}
          alt="Illustrative electrical installation within a contemporary home"
          priority
        />
      </section>
      <TradeDetails theme="electrical" slug="phase-studio" />
    </div>
  );
}

export function CurrentCare() {
  return (
    <div className="trade-site current-care">
      <section className="current-hero">
        <div className="current-top">
          <p className="trade-kicker">Current Care / Let’s work it out</p>
          <span>Home · Property · Small business</span>
        </div>
        <div className="current-heading">
          <h1>
            A clearer route
            <br />
            to electrical <em>help.</em>
          </h1>
          <p>
            You don’t need to know the technical name. Start with what’s
            happening, or what you want to change.
          </p>
        </div>
        <div className="current-paths">
          <Link href="/examples/current-care/fault-finding">
            <span>Something isn’t working</span>
            <strong>Find a fault</strong>
            <b aria-hidden="true">↗</b>
          </Link>
          <Link href="/examples/current-care/electrical-inspections">
            <span>I want a clearer picture</span>
            <strong>Plan a check</strong>
            <b aria-hidden="true">↗</b>
          </Link>
          <Link href="/examples/current-care/lighting-and-installation">
            <span>I’m improving my space</span>
            <strong>Discuss new work</strong>
            <b aria-hidden="true">↗</b>
          </Link>
        </div>
        <div className="current-foot">
          <p>
            Not sure where to start? A few details make the first conversation
            easier.
          </p>
          <TradeLink>Prepare your enquiry</TradeLink>
        </div>
      </section>
      <section className="current-image">
        <VariantImage
          src={electricalImage}
          alt="Illustrative electrician assessing an installation"
          priority
        />
        <div>
          <span className="trade-kicker">
            A little preparation goes a long way
          </span>
          <h2>
            Your observations.
            <br />
            Our starting point.
          </h2>
          <p>
            Tell us which rooms are affected, when the issue happens and whether
            anything has changed recently.
          </p>
        </div>
      </section>
      <TradeDetails theme="electrical" slug="current-care" />
    </div>
  );
}
