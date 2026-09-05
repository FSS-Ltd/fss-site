import { ExampleEnquiry } from "../enquiry";
import { VariantImage, VariantServices, VariantProcess } from "./parts";
export function SlateHouseExample() {
  return (
    <>
      <section className="slate-hero">
        <p className="example-eyebrow">Slate House / Architectural roofing</p>
        <h1>
          The quiet art
          <br />
          of <em>finishing well.</em>
        </h1>
        <div className="slate-hero-caption">
          <p>
            Considered roofs for considered homes.
            <br />
            Materials, proportions and every junction in between.
          </p>
          <a href="#enquire">Discuss a project ↗</a>
        </div>
        <VariantImage
          priority
          src="/prospect-previews/bespoke/primeline-roofing/hero-day-v1.webp"
          alt="Illustrative contemporary home with a carefully detailed roof"
        />
        <span className="slate-image-index">01 / An architectural study</span>
      </section>
      <section className="slate-statement example-section" data-reveal>
        <p className="example-eyebrow">
          The line between shelter and architecture
        </p>
        <h2>
          A roof should belong
          <br />
          to the building.
          <br />
          <em>In every detail.</em>
        </h2>
        <p>
          The way a surface meets an edge. The proportion of a rooflight. The
          rhythm of the covering. We begin with the whole picture, then work
          through the details that bring it together.
        </p>
      </section>
      <VariantServices
        theme="roof"
        slug="slate-house"
        title="Material. Method. Finish."
      />
      <section className="slate-materials" data-reveal>
        <div>
          <span>01</span>
          <h3>The surface</h3>
          <p>
            A covering chosen for the building, its context and the structure
            beneath.
          </p>
        </div>
        <div>
          <span>02</span>
          <h3>The junction</h3>
          <p>
            Clear decisions at rooflights, chimneys and every change in plane.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>The finish</h3>
          <p>
            A considered roofline and a final conversation about the work
            completed.
          </p>
        </div>
      </section>
      <VariantProcess
        title="From an idea to a considered roof."
        steps={[
          [
            "The first conversation",
            "Your building, the intended work and what a good result looks like to you.",
          ],
          [
            "The considered specification",
            "Materials, interfaces and access, explained before the work is agreed.",
          ],
          [
            "The finished detail",
            "A shared understanding of the sequence and the final review.",
          ],
        ]}
      />
      <ExampleEnquiry theme="roof" />
    </>
  );
}
