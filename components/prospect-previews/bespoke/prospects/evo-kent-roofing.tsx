import { Home } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { EvoRoofRestorationHero } from "./evo-roof-restoration-hero";

const fields = [
  {
    id: "work",
    label: "What roofing work do you need?",
    type: "select",
    options: ["Roof repair", "Flat roof", "Pitched roof", "Roof replacement"],
  },
  {
    id: "property",
    label: "Property type",
    type: "select",
    options: ["Home", "Business", "Public building"],
  },
  {
    id: "urgency",
    label: "How soon do you need help?",
    type: "select",
    options: ["Urgent repair", "This month", "Planning a project"],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "postcode",
    placeholder: "DA12…",
  },
  {
    id: "photo",
    label: "Add a photo (demo only)",
    type: "file",
    accept: "image/*",
  },
] as const;

export function EvoKentRoofingPage() {
  return (
    <div
      className="min-h-screen bg-[#edf3f5] text-[#163449]"
      data-bespoke-prospect="evo-kent-roofing"
    >
      <ConceptBar businessName="Evo Kent Roofing" />
      <main>
        <EvoRoofRestorationHero />
        <RevealOnScroll
          as="section"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8"
        >
          <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#2b5672]">
                One route, three settings
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-.045em] sm:text-6xl">
                Roof work changes with the building.
              </h2>
            </div>
            <div className="space-y-3">
              {[
                "A repair at home",
                "A replacement for a business",
                "Planned work on a public building",
              ].map((x) => (
                <div
                  className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm"
                  key={x}
                >
                  <Home className="size-5 text-[#2b5672]" />
                  <span className="font-bold">{x}</span>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
        <section className="bg-[#d9e5e9] px-5 py-20 sm:px-8" id="assessment">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.2em]">
                Site-visit ready
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                Give the team a clearer view before they call.
              </h2>
              <p className="mt-5 leading-7 text-[#496474]">
                The photo field is a local demonstration only. A live build
                could securely attach it to the enquiry.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Evo Kent Roofing"
                buttonLabel="Prepare roofing assessment"
                fields={fields}
                formClassName="rounded-[2.5rem] bg-white p-6 shadow-xl sm:p-9"
                successTitle="The assessment brief is ready"
                successMessage="A live version could give Evo Kent the building, work, urgency and photo context before arranging a visit."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Evo Kent Roofing" />
    </div>
  );
}
