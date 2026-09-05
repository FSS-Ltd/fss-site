import { VariantImage } from "../../variants/parts";
import { CollectionEnd, gardenImage } from "./parts";
export function OpenGroundExample() {
  return (
    <div className="hl-site hl-open">
      <section className="hl-open-hero">
        <div className="hl-open-copy">
          <p className="hl-kicker">Open Ground / Landscape design studio</p>
          <h1>
            Your next
            <br />
            chapter
            <br />
            <em>is outside.</em>
          </h1>
          <p>
            A whole new garden or a thoughtful change. Let’s find the right
            starting point.
          </p>
          <a className="hl-button" href="#enquire">
            Build your garden brief ↗
          </a>
          <span>No plans needed to begin.</span>
        </div>
        <VariantImage
          priority
          src={gardenImage}
          alt="Illustrative designed garden with soft planting and a paved route through the space"
        />
        <div className="hl-open-tag">
          <span>START WITH POSSIBILITY</span>
          <strong>
            Room
            <br />
            to grow.
          </strong>
          <a href="#starting-point">Find your starting point ↓</a>
        </div>
      </section>
      <section className="hl-open-start" id="starting-point">
        <p className="hl-kicker">One space. Many possibilities.</p>
        <h2>
          Where would you
          <br />
          <em>like to begin?</em>
        </h2>
        <div>
          {[
            [
              "01",
              "The whole picture",
              "A complete design for the way you want to live outside.",
            ],
            [
              "02",
              "A fresh layer",
              "Planting, texture and seasonal interest in an existing garden.",
            ],
            [
              "03",
              "A new connection",
              "Bring a new home, extension or courtyard into its surroundings.",
            ],
          ].map(([n, h, p]) => (
            <a key={n} href="#enquire">
              <span>{n} ↗</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </a>
          ))}
        </div>
      </section>
      <CollectionEnd theme="landscape" slug="open-ground" />
    </div>
  );
}
