import { VariantImage } from "../../variants/parts";
import { CollectionEnd, gardenImage } from "./parts";
export function FieldnoteStudioExample() {
  return (
    <div className="hl-site hl-fieldnote">
      <section className="hl-field-hero">
        <div className="hl-field-meta">
          <p>
            FIELDNOTE STUDIO
            <br />
            Gardens & living landscapes
          </p>
          <p>
            Notes on place
            <br />
            Volume 01 / Kent
          </p>
        </div>
        <h1>
          Outside,
          <br />
          <em>beautifully.</em>
        </h1>
        <div className="hl-field-image">
          <VariantImage
            priority
            src={gardenImage}
            alt="Illustrative naturalistic garden with layered planting and a stone pathway"
          />
          <span>Fig. 01 / A place to be, not just a view.</span>
        </div>
        <p className="hl-field-intro">
          A garden with feeling.
          <br />A landscape with a story.
          <br />A little more life outside.
        </p>
        <a href="#enquire" className="hl-field-link">
          Tell us about
          <br />
          your place ↗
        </a>
      </section>
      <section className="hl-field-manifesto" data-reveal>
        <span className="hl-kicker">From our notebook</span>
        <h2>
          We like gardens
          <br />
          with{" "}
          <em>
            something
            <br />
            to say.
          </em>
        </h2>
        <div>
          <p>
            A path that invites a detour. Planting that catches the low sun. A
            seat exactly where you want to stop.
          </p>
          <p>
            Thoughtful design is found in these moments. We consider the whole
            place, then give the details the attention they deserve.
          </p>
        </div>
      </section>
      <CollectionEnd theme="landscape" slug="fieldnote-studio" />
    </div>
  );
}
