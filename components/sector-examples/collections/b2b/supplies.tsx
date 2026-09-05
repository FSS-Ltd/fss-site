import { ExampleEnquiry } from "../../enquiry";
import { GuideIndex, ProcurementSteps } from "./parts";
import { ScrollStory, SupplyObjects } from "./objects";

export function OrbitSupplyExample() {
  return (
    <div className="b2b-page orbit-supply">
      <section className="folio-hero">
        <p className="example-eyebrow">Orbit / Tools for a working day</p>
        <h1>
          Big ideas.
          <br />
          <em>Small essentials.</em>
        </h1>
        <p>
          Paper to presentation. First desk to full office.
          <br />
          Give good work the things it needs.
        </p>
        <a className="b2b-button" href="#enquire">
          Build your supply brief ↗
        </a>
        <ScrollStory />
        <div className="folio-bottom">
          <span>WORKDAY OBJECTS / A CONSIDERED SELECTION</span>
          <a href="#services">Keep exploring ↓</a>
        </div>
      </section>
      <section className="folio-statement" data-reveal>
        <p className="example-eyebrow">The details keep things moving</p>
        <h2>
          A page for a thought.
          <br />A pen for a plan.
          <br />
          <em>A partner for the rest.</em>
        </h2>
        <p>
          We bring everyday office purchasing into one clear conversation. Start
          with the items you need, then compare the specifications and
          practicalities before you order.
        </p>
      </section>
      <GuideIndex
        theme="supplies"
        slug="orbit-supply"
        title="Make a more informed shortlist."
      />
      <ProcurementSteps />
      <ExampleEnquiry theme="supplies" />
    </div>
  );
}

export function SupplyIndexExample() {
  return (
    <div className="b2b-page supply-index">
      <section className="index-hero">
        <div className="index-masthead">
          <span>THE BUYER’S DESK</span>
          <span>OFFICE PROCUREMENT / EXPLAINED</span>
        </div>
        <div className="index-hero-grid">
          <div>
            <p className="example-eyebrow">Supply Index</p>
            <h1>
              Compare the detail.
              <br />
              <em>Buy with clarity.</em>
            </h1>
            <p>
              Useful specifications. Clear pack sizes. A quote that makes sense
              for the way your office works.
            </p>
            <a className="b2b-button" href="#services">
              Open the buying guides ↓
            </a>
          </div>
          <div className="index-spec">
            <span className="example-eyebrow">
              Anatomy of a better comparison
            </span>
            <h2>
              The price is
              <br />
              only one line.
            </h2>
            <dl>
              <div>
                <dt>Specification</dt>
                <dd>Fit for the task</dd>
              </div>
              <div>
                <dt>Pack size</dt>
                <dd>Compare like for like</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>Check the whole cost</dd>
              </div>
              <div>
                <dt>Alternatives</dt>
                <dd>Agree substitutions</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
      <GuideIndex
        theme="supplies"
        slug="supply-index"
        title="Good questions. Better purchasing."
      />
      <section className="index-comparison" data-reveal>
        <p className="example-eyebrow">A useful distinction</p>
        <h2>Unit price ≠ basket cost.</h2>
        <p>
          A lower headline price may describe a smaller pack. Check units, VAT
          treatment, delivery and whether an alternative meets the same need.
          Ask for the complete quote before comparing suppliers.
        </p>
        <a href="#enquire">Discuss a recurring order ↗</a>
      </section>
      <ProcurementSteps />
      <ExampleEnquiry theme="supplies" />
    </div>
  );
}

export function CommonplaceOfficeExample() {
  return (
    <div className="b2b-page commonplace-office">
      <section className="commonplace-hero">
        <div className="commonplace-title">
          <p className="example-eyebrow">
            Commonplace / Objects for office life
          </p>
          <h1>
            The everyday,
            <br />
            <em>well considered.</em>
          </h1>
        </div>
        <div className="commonplace-cover">
          <SupplyObjects />
          <p>
            Good work begins with simple things.
            <br />
            Chosen for purpose. Ready for the day.
          </p>
        </div>
        <div className="commonplace-intro">
          <span>01 / THE OFFICE COLLECTION</span>
          <p>
            For the notes in the margin, the plans on the wall and the people
            around the table. Practical supplies, thoughtfully brought together.
          </p>
          <a href="#enquire">Tell us what you’re working on ↗</a>
        </div>
      </section>
      <section className="commonplace-manifesto" data-reveal>
        <span className="commonplace-star" aria-hidden="true">
          ✳
        </span>
        <h2>
          There is a quiet
          <br />
          satisfaction in
          <br />
          <em>being prepared.</em>
        </h2>
        <p>
          A new workspace. A team coming together. The monthly restock. Let’s
          make the list useful, the choices clear and the next step
          straightforward.
        </p>
      </section>
      <GuideIndex
        theme="supplies"
        slug="commonplace-office"
        title="Notes on choosing well."
      />
      <ProcurementSteps />
      <ExampleEnquiry theme="supplies" />
    </div>
  );
}

export function DeskReadyExample() {
  return (
    <div className="b2b-page desk-ready">
      <section className="desk-hero">
        <div>
          <p className="example-eyebrow">Desk Ready / Office supply planning</p>
          <h1>
            Your next order.
            <br />
            <span>Already clearer.</span>
          </h1>
          <p>
            Opening an office or keeping one running? Start with what you need.
            Shape a useful quote brief in a few simple steps.
          </p>
          <a className="b2b-button" href="#enquire">
            Start my supply brief ↗
          </a>
          <span className="desk-demo">
            Interactive example · No order is placed
          </span>
        </div>
        <aside className="desk-checklist">
          <div className="desk-checklist-top">
            <span>YOUR PROCUREMENT NOTES</span>
            <span aria-hidden="true">↗</span>
          </div>
          <h2>
            A little preparation.
            <br />A better quote.
          </h2>
          <ol>
            <li>
              <span>01</span> List the items and quantities
            </li>
            <li>
              <span>02</span> Add essential specifications
            </li>
            <li>
              <span>03</span> Note your delivery timing
            </li>
            <li>
              <span>04</span> Flag recurring requirements
            </li>
          </ol>
          <a href="#enquire">Let’s put it together →</a>
        </aside>
      </section>
      <div className="desk-route-strip">
        <span>New office setup</span>
        <span>Regular replenishment</span>
        <span>Product comparison</span>
      </div>
      <ExampleEnquiry theme="supplies" />
      <GuideIndex
        theme="supplies"
        slug="desk-ready"
        title="Need to check something first?"
      />
      <ProcurementSteps />
    </div>
  );
}
