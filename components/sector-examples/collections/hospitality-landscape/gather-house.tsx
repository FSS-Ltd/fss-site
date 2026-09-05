import { CollectionEnd, diningImage } from "./parts";
import { VariantImage } from "../../variants/parts";
export function GatherHouseExample() {
  return (
    <div className="hl-site hl-gather">
      <section className="hl-gather-hero">
        <div className="hl-gather-title">
          <p className="hl-kicker">Gather House / Food. People. Possibility.</p>
          <h1>
            Great company.
            <br />
            <em>
              We’ll set
              <br />
              the scene.
            </em>
          </h1>
          <p>
            From a table for two to a room for your favourite people. Start with
            the occasion.
          </p>
        </div>
        <div className="hl-gather-picker">
          <span className="hl-kicker">Let’s make a plan / 01</span>
          <h2>
            What brings
            <br />
            you together?
          </h2>
          <a href="#enquire">
            <span>01</span> A table & a good meal <b aria-hidden="true">↗</b>
          </a>
          <a href="#enquire">
            <span>02</span> A private celebration <b aria-hidden="true">↗</b>
          </a>
          <a href="#enquire">
            <span>03</span> The whole team <b aria-hidden="true">↗</b>
          </a>
          <p>
            Explore the demo enquiry. Availability and bookings are not live.
          </p>
        </div>
      </section>
      <section className="hl-gather-detail" data-reveal>
        <VariantImage
          src={diningImage}
          alt="Illustrative hospitality setting"
        />
        <div>
          <p className="hl-kicker">A little detail goes a long way</p>
          <h2>
            Your people.
            <br />
            Your occasion.
            <br />
            <em>A considered plan.</em>
          </h2>
          <p>
            Tell us your date, numbers and what a good gathering looks like to
            you. The menu, the room and the practical details can follow.
          </p>
          <a className="hl-button" href="#services">
            Explore the possibilities ↗
          </a>
        </div>
      </section>
      <CollectionEnd theme="hospitality" slug="gather-house" />
    </div>
  );
}
