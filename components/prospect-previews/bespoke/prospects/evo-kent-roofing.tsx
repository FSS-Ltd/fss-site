import { CloudRain, Home } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

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
      className="min-h-screen overflow-hidden bg-[#edf3f5] text-[#163449]"
      data-bespoke-prospect="evo-kent-roofing"
    >
      <ConceptBar businessName="Evo Kent Roofing" />
      <main>
        <section className="relative mx-auto max-w-[95rem] overflow-hidden rounded-b-[3rem] bg-[#2b5672] text-white sm:rounded-b-[5rem]">
          <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
            <span className="text-xl font-black tracking-tight">
              EVO <span className="font-light">KENT ROOFING</span>
            </span>
            <a
              className="rounded-full border border-white/25 px-5 py-2 text-sm font-bold"
              href="#assessment"
            >
              Request assessment
            </a>
          </header>
          <div className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-4 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
            <RevealOnScroll className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[.22em] text-sky-200">
                Homes · Businesses · Public buildings
              </p>
              <h1 className="mt-6 text-5xl font-black leading-[.94] tracking-[-.055em] sm:text-7xl">
                See the roof. Understand the work. Plan the visit.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
                Repairs and replacements across Kent, with property, urgency and
                photo context collected before the assessment call.
              </p>
            </RevealOnScroll>
            <RevealOnScroll
              className="relative h-[34rem] [perspective:1100px]"
              delay={100}
            >
              <div className="absolute left-[8%] right-[2%] top-[14%] h-[55%] [transform:rotateX(58deg)_rotateZ(-13deg)]">
                <div className="absolute inset-0 bg-[#8fa7b2] shadow-[0_55px_75px_-25px_rgba(8,28,40,.8)] [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
                <div className="absolute inset-[7%] bg-[#c9d4d8] [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
                <div className="absolute inset-[15%] bg-[#5d7180] [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div
                  className="absolute h-12 w-40 rounded-lg bg-gradient-to-b from-[#4b6070] to-[#203d50] shadow-xl"
                  key={i}
                  style={{
                    right: `${8 + i * 12}%`,
                    top: `${13 + i * 11}%`,
                    transform: `rotate(-13deg) translateZ(${i * 18}px)`,
                  }}
                />
              ))}
              <div className="absolute bottom-[8%] left-[3%] flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
                <CloudRain className="size-8 text-sky-200" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                    Assessment context
                  </p>
                  <p className="mt-1 font-bold">Roof · Property · Urgency</p>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>
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
