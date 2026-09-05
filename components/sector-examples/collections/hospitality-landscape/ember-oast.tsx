import { VariantImage } from "../../variants/parts";
import { CollectionEnd, diningImage } from "./parts";
export function EmberOastExample() {
  return (
    <div className="hl-site hl-ember">
      <section className="hl-ember-hero">
        <div className="hl-ember-top">
          <span>Restaurant · Taproom · Gatherings</span>
          <span>Kent / A fictional dining house</span>
        </div>
        <h1>
          Stay for
          <br />
          the <em>evening.</em>
        </h1>
        <VariantImage
          priority
          src={diningImage}
          alt="Illustrative warm restaurant interior set for an evening gathering"
        />
        <div className="hl-ember-bottom">
          <p>
            Fire in the kitchen.
            <br />
            Something good in your glass.
            <br />
            Nowhere else to be.
          </p>
          <a className="hl-button" href="#enquire">
            Find your table ↗
          </a>
          <span>Scroll into the evening ↓</span>
        </div>
      </section>
      <section className="hl-ember-story" data-reveal>
        <span className="hl-kicker">01 / The gathering</span>
        <h2>
          First, the hello.
          <br />
          Then, <em>everything else.</em>
        </h2>
        <p>
          Come for a drink that turns into dinner. A long lunch that becomes an
          afternoon. Or an occasion that deserves the whole room.
        </p>
        <div className="hl-wordline" aria-hidden="true">
          FIRE &nbsp; FIELD &nbsp; FRIENDS
        </div>
      </section>
      <CollectionEnd theme="hospitality" slug="ember-oast" />
    </div>
  );
}
