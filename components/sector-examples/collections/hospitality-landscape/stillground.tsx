import { VariantImage } from "../../variants/parts";
import { CollectionEnd, gardenImage } from "./parts";
export function StillgroundExample() {
  return (
    <div className="hl-site hl-stillground">
      <section className="hl-still-hero">
        <VariantImage
          priority
          src={gardenImage}
          alt="Illustrative garden with stone paths, natural planting and a designer studying plans"
        />
        <div className="hl-still-copy">
          <p className="hl-kicker">Stillground / Landscape design</p>
          <h1>
            A quieter
            <br />
            kind of
            <br />
            <em>extraordinary.</em>
          </h1>
          <a href="#enquire" className="hl-button">
            Begin your landscape ↗
          </a>
        </div>
        <span className="hl-still-caption">
          Light. Time. A sense of place.
          <br />
          Illustrative garden study / Kent
        </span>
      </section>
      <section className="hl-still-story" data-reveal>
        <p className="hl-kicker">The place comes first</p>
        <h2>
          Follow the light.
          <br />
          Listen to the land.
          <br />
          <em>Leave room for life.</em>
        </h2>
        <p>
          A garden is never finished in a single season. We begin with the
          lasting structure, the routes you take, the places you pause and the
          planting that gives each month its own character.
        </p>
      </section>
      <CollectionEnd theme="landscape" slug="stillground" />
    </div>
  );
}
