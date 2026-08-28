import { ArrowUpRight } from "lucide-react";

import { RevealOnScroll } from "../../reveal-on-scroll";
import { ConceptBar } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { KentGarageEquipmentHero } from "./kent-garage-equipment-hero";

const fields = [
  {
    id: "project",
    label: "What does your workshop need?",
    type: "select",
    options: [
      "MOT-bay design",
      "Equipment supply and installation",
      "Maintenance",
      "Workshop upgrade",
    ],
  },
  {
    id: "location",
    label: "Site postcode",
    type: "postcode",
    placeholder: "ME4…",
  },
  {
    id: "timing",
    label: "Project timing",
    type: "select",
    options: ["Ready to start", "This quarter", "Early planning"],
  },
  {
    id: "email",
    label: "Work email",
    type: "email",
    placeholder: "name@workshop.co.uk",
  },
] as const;

const services = [
  "MOT bay design",
  "Vehicle lifts",
  "Garage cabinets",
  "Alignment stations",
] as const;

export function KentGarageEquipmentPage() {
  return (
    <div
      className="kgePage min-h-screen overflow-hidden"
      data-bespoke-prospect="kent-garage-equipment"
    >
      <ConceptBar businessName="Kent Garage Equipment" />
      <main>
        <KentGarageEquipmentHero />

        <RevealOnScroll as="section" className="kgeSupportSection">
          <p className="kgeSupportEyebrow">Workshop systems · Chatham</p>
          <h2>From the first site survey to the work after installation.</h2>
          <p>
            Kent Garage Equipment helps workshops plan the equipment around the
            way technicians work, then supplies, installs and supports the
            finished space.
          </p>
        </RevealOnScroll>

        <section className="kgeServiceGrid" aria-label="Workshop equipment">
          {services.map((service, index) => (
            <RevealOnScroll className="kgeServiceCard" key={service}>
              <article>
                <p>KGE / {String(index + 1).padStart(2, "0")}</p>
                <h2>{service}</h2>
              </article>
            </RevealOnScroll>
          ))}
        </section>

        <RevealOnScroll as="section" className="kgeActionSection">
          <p className="kgeSupportEyebrow">A clearer starting point</p>
          <div>
            <h2>Start with the workshop, not a generic enquiry.</h2>
            <p>
              A concise project brief gives the team the site, equipment need
              and timing before the first conversation.
            </p>
          </div>
          <a className="kgeActionButton" href="#project">
            Prepare a project brief <ArrowUpRight aria-hidden="true" />
          </a>
        </RevealOnScroll>

        <section className="kgeEnquirySection" id="project">
          <RevealOnScroll className="kgeEnquiryHeading">
            <p className="kgeSupportEyebrow">Project intake</p>
            <h2>Frame the equipment conversation.</h2>
            <p>
              Project type, site and timing give the team enough context to
              prepare a relevant response.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={80}>
            <DemoEnquiry
              businessName="Kent Garage Equipment"
              buttonLabel="Prepare workshop enquiry"
              fields={fields}
              formClassName="kgeEnquiryCard"
              successTitle="The workshop brief is ready"
              successMessage="A live version could route this project by equipment need, site and timing before the first call."
            />
          </RevealOnScroll>
        </section>
      </main>

      <aside className="kgeConceptNotice">
        <p className="kgeSupportEyebrow">Private website concept</p>
        <h2>Interested in taking this further?</h2>
        <p>
          FSS can refine the visual direction, connect the enquiry journey and
          prepare a launch-ready version after approval.
        </p>
        <a className="kgeFssContactCta" href="/contact">
          Talk to FSS <ArrowUpRight aria-hidden="true" />
        </a>
      </aside>
    </div>
  );
}
