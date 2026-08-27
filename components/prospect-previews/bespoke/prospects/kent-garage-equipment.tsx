import { Box, Settings2 } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

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

export function KentGarageEquipmentPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#efefeb] text-[#252525]"
      data-bespoke-prospect="kent-garage-equipment"
    >
      <ConceptBar businessName="Kent Garage Equipment" />
      <header className="mx-auto flex max-w-[90rem] items-center justify-between border-b border-black/15 px-5 py-6 sm:px-8">
        <span className="text-lg font-black uppercase tracking-[.08em]">
          Kent Garage <span className="font-light">Equipment</span>
        </span>
        <a
          className="bg-[#252525] px-5 py-3 text-xs font-black uppercase tracking-wider text-white"
          href="#project"
        >
          Scope a project
        </a>
      </header>
      <main>
        <section className="mx-auto grid max-w-[90rem] gap-0 border-x border-black/15 lg:grid-cols-[1fr_1fr]">
          <RevealOnScroll className="flex min-h-[42rem] flex-col justify-between border-b border-black/15 p-6 sm:p-12 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black uppercase tracking-[.22em]">
              Workshop systems · Chatham
            </p>
            <div>
              <h1 className="text-5xl font-black uppercase leading-[.88] tracking-[-.065em] sm:text-7xl">
                Design.
                <br />
                Install.
                <br />
                <span className="text-[#777]">Maintain.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-black/60">
                Take a workshop from DVSA MOT-bay design through equipment
                installation, training and aftercare.
              </p>
            </div>
            <a
              className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-wider"
              href="#project"
            >
              Start with the workshop <span className="text-2xl">↘</span>
            </a>
          </RevealOnScroll>
          <RevealOnScroll
            className="relative min-h-[42rem] overflow-hidden bg-[#303234] [perspective:1100px]"
            delay={80}
          >
            <div className="absolute inset-x-[12%] bottom-[18%] top-[15%] [transform:rotateY(-14deg)_rotateX(8deg)]">
              <div className="absolute inset-x-0 bottom-0 h-8 bg-[#d7dbda] shadow-2xl" />
              <div className="absolute bottom-8 left-[7%] h-[78%] w-8 bg-gradient-to-r from-[#aeb4b4] to-[#f0f2f1]" />
              <div className="absolute bottom-8 right-[7%] h-[78%] w-8 bg-gradient-to-r from-[#aeb4b4] to-[#f0f2f1]" />
              <div className="absolute left-[7%] right-[7%] top-[8%] h-8 bg-[#d7dbda]" />
              <div className="absolute bottom-[16%] left-[20%] right-[20%] h-[31%] rounded-[48%_52%_12%_12%] bg-gradient-to-b from-[#e7b100] to-[#5d4705] shadow-xl">
                <span className="absolute bottom-[-14%] left-[8%] size-14 rounded-full border-[10px] border-[#090a0b] bg-[#7b7e7e]" />
                <span className="absolute bottom-[-14%] right-[8%] size-14 rounded-full border-[10px] border-[#090a0b] bg-[#7b7e7e]" />
              </div>
            </div>
            <div className="absolute bottom-8 left-8 right-8 flex justify-between border-t border-white/15 pt-5 text-white">
              <span className="text-xs font-bold uppercase tracking-widest text-white/45">
                Complete bay concept
              </span>
              <Settings2 className="size-6 text-yellow-400" />
            </div>
          </RevealOnScroll>
        </section>
        <RevealOnScroll
          as="section"
          className="mx-auto grid max-w-[90rem] border-x border-t border-black/15 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            "MOT-bay design",
            "Supply & installation",
            "Training",
            "Aftercare",
          ].map((x, i) => (
            <article
              className="min-h-52 border-b border-r border-black/15 p-7"
              key={x}
            >
              <p className="font-mono text-sm text-black/35">KGE / 0{i + 1}</p>
              <Box className="mt-12 size-6" />
              <h2 className="mt-4 font-black uppercase">{x}</h2>
            </article>
          ))}
        </RevealOnScroll>
        <section className="bg-[#d9b61a] px-5 py-20 sm:px-8" id="project">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.2em]">
                Project intake
              </p>
              <h2 className="mt-5 text-5xl font-black uppercase leading-[.9] tracking-[-.055em]">
                Frame the equipment conversation.
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-black/65">
                Project type, site and timing give the team enough context to
                prepare a relevant response.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Kent Garage Equipment"
                buttonLabel="Prepare workshop enquiry"
                fields={fields}
                formClassName="bg-[#f7f7f2] p-6 shadow-[14px_14px_0_#252525] sm:p-9"
                successTitle="The workshop brief is ready"
                successMessage="A live version could route this project by equipment need, site and timing before the first call."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Kent Garage Equipment" />
    </div>
  );
}
