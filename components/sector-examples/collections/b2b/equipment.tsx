import { ExampleEnquiry } from "../../enquiry";
import { GuideIndex, ProcurementSteps } from "./parts";
import { LiftDrawing, ScrollStory } from "./objects";

export function AxisWorkshopExample() {
  return (
    <div className="b2b-page axis-workshop">
      <section className="axis-hero">
        <div className="axis-topline">
          <span>AXIS / WORKSHOP SYSTEMS</span>
          <span>BUILT AROUND THE WORK</span>
        </div>
        <h1>
          Raise your
          <br />
          <em>expectations.</em>
        </h1>
        <ScrollStory equipment />
        <div className="axis-hero-footer">
          <p>
            The equipment is only the beginning.
            <br />
            Plan the space, installation and support around it.
          </p>
          <a className="b2b-button" href="#enquire">
            Plan your workshop ↗
          </a>
        </div>
      </section>
      <section className="axis-statement" data-reveal>
        <p className="example-eyebrow">Every bay has a purpose</p>
        <h2>
          More than machinery.
          <br />
          <span>A working system.</span>
        </h2>
        <p>
          From vehicle lifts to tyre equipment, the right choice starts with
          your workload and your site. Put practical requirements first, then
          make the specification fit.
        </p>
      </section>
      <GuideIndex
        theme="equipment"
        slug="axis-workshop"
        title="Get the foundations right."
      />
      <ProcurementSteps equipment />
      <ExampleEnquiry theme="equipment" />
    </div>
  );
}

export function WorkshopReferenceExample() {
  return (
    <div className="b2b-page workshop-reference">
      <section className="reference-hero">
        <div className="reference-tab">WR / THE WORKSHOP REFERENCE</div>
        <div className="reference-hero-grid">
          <div>
            <p className="example-eyebrow">
              Equipment selection, without the guesswork
            </p>
            <h1>
              Know the site.
              <br />
              Understand the spec.
              <br />
              <em>Choose the equipment.</em>
            </h1>
            <p>
              A practical starting point for workshop owners comparing lifts,
              tyre equipment and installation support.
            </p>
            <a className="b2b-button" href="#services">
              Explore the equipment guides ↓
            </a>
          </div>
          <aside className="reference-notebook">
            <span>BEFORE YOU REQUEST A QUOTE</span>
            <h2>
              The site
              <br />
              comes first.
            </h2>
            <dl>
              <div>
                <dt>01 / Floor</dt>
                <dd>Condition and suitability to assess</dd>
              </div>
              <div>
                <dt>02 / Space</dt>
                <dd>Working clearance, not just footprint</dd>
              </div>
              <div>
                <dt>03 / Services</dt>
                <dd>Power and air requirements</dd>
              </div>
              <div>
                <dt>04 / Access</dt>
                <dd>Delivery and installation route</dd>
              </div>
            </dl>
            <p>A supplier should confirm the model-specific requirements.</p>
          </aside>
        </div>
      </section>
      <GuideIndex
        theme="equipment"
        slug="workshop-reference"
        title="Your next decision, explained."
      />
      <section className="reference-answer" data-reveal>
        <span>THE SHORT ANSWER</span>
        <h2>
          Will it fit?
          <br />
          That’s only the first question.
        </h2>
        <p>
          The floor, power supply, vehicle mix and space around the equipment
          matter too. A suitable footprint is a starting point for a site
          assessment, not confirmation that installation can go ahead.
        </p>
        <a href="#enquire">Prepare an equipment enquiry ↗</a>
      </section>
      <ProcurementSteps equipment />
      <ExampleEnquiry theme="equipment" />
    </div>
  );
}

export function IronfieldEquipmentExample() {
  return (
    <div className="b2b-page ironfield-equipment">
      <section className="ironfield-hero">
        <div className="ironfield-title">
          <p className="example-eyebrow">Ironfield / Workshop equipment</p>
          <h1>
            For the work
            <br />
            <em>that matters.</em>
          </h1>
          <span>TOOLS. SPACE. KNOW-HOW.</span>
        </div>
        <div className="ironfield-illustration">
          <LiftDrawing />
          <span className="ironfield-plate">STUDY 01 / THE WORKING BAY</span>
        </div>
        <div className="ironfield-caption">
          <span>DESIGNED AROUND THE DAY</span>
          <p>
            There is a rhythm to a good workshop. The tools within reach. The
            room to move. The confidence to get on with it.
          </p>
          <a href="#enquire">Let’s talk about your space ↗</a>
        </div>
      </section>
      <section className="ironfield-editorial" data-reveal>
        <span aria-hidden="true">I.</span>
        <div>
          <p className="example-eyebrow">Equipment is a long conversation</p>
          <h2>
            Think beyond
            <br />
            <em>installation day.</em>
          </h2>
          <p>
            Choosing a machine also means considering maintenance, parts and
            ongoing support. We put those questions on the table at the
            beginning, alongside capacity, layout and the practical demands of
            your work.
          </p>
        </div>
      </section>
      <GuideIndex
        theme="equipment"
        slug="ironfield-equipment"
        title="Field notes for your workshop."
      />
      <ProcurementSteps equipment />
      <ExampleEnquiry theme="equipment" />
    </div>
  );
}

export function BayPlanExample() {
  return (
    <div className="b2b-page bay-plan">
      <section className="bay-hero">
        <div className="bay-headline">
          <p className="example-eyebrow">
            Bay Plan / Workshop equipment & support
          </p>
          <h1>
            Make room for
            <br />
            <span>your next move.</span>
          </h1>
          <p>
            New equipment. A new layout. An existing machine that needs
            attention. Give the first conversation a useful starting point.
          </p>
          <a className="b2b-button" href="#enquire">
            Build my workshop brief ↗
          </a>
          <span className="desk-demo">
            Try the enquiry · No appointment is booked
          </span>
        </div>
        <div className="bay-planner">
          <div className="bay-planner-heading">
            <span>THE WORKSHOP BRIEF</span>
            <span>START HERE ↙</span>
          </div>
          <div
            className="bay-floorplan"
            role="img"
            aria-label="Illustrative workshop floor plan with space for two working bays"
          >
            <div>
              <span>BAY 01</span>
              <i />
            </div>
            <div>
              <span>BAY 02</span>
              <i />
            </div>
            <span className="bay-access">ACCESS & CIRCULATION</span>
          </div>
          <p>
            A plan shaped around your site.
            <br />A quote shaped around your requirements.
          </p>
        </div>
      </section>
      <ExampleEnquiry theme="equipment" />
      <section className="bay-preparation" data-reveal>
        <p className="example-eyebrow">Useful to have ready</p>
        <h2>
          Bring the brief.
          <br />
          We’ll help with the questions.
        </h2>
        <div>
          <p>
            <strong>For new equipment</strong>Your vehicle mix, approximate
            dimensions and the type of work you want to do.
          </p>
          <p>
            <strong>For service enquiries</strong>The equipment make and model,
            a description of the issue and whether it is safely out of use.
          </p>
        </div>
      </section>
      <GuideIndex
        theme="equipment"
        slug="bay-plan"
        title="Plan with more perspective."
      />
      <ProcurementSteps equipment />
    </div>
  );
}
