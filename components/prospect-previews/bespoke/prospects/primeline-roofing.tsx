import { Camera, MapPin } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "work",
    label: "What work do you need?",
    type: "select",
    options: ["Roof repair", "Roof replacement", "New roof", "Free site visit"],
  },
  {
    id: "property",
    label: "Property type",
    type: "select",
    options: ["House", "Flat", "Commercial property", "Other"],
  },
  {
    id: "urgency",
    label: "How urgent is the work?",
    type: "select",
    options: ["Urgent", "This month", "Planning ahead"],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "postcode",
    placeholder: "ME4…",
  },
  {
    id: "photo",
    label: "Add a roof photo (demo only)",
    type: "file",
    accept: "image/*",
  },
] as const;

export function PrimelineRoofingPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#071126] text-white"
      data-bespoke-prospect="primeline-roofing"
    >
      <div className="border-b border-white/10">
        <ConceptBar businessName="Primeline Roofing" />
      </div>
      <main>
        <section className="relative min-h-[88vh]">
          <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
            <span className="text-xl font-black uppercase tracking-tight">
              PRIMELINE <span className="text-[#51a0ff]">ROOFING</span>
            </span>
            <a
              className="rounded-lg bg-[#2575fc] px-5 py-3 text-sm font-black"
              href="#visit"
            >
              Free site visit
            </a>
          </header>
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[.9fr_1.1fr]">
            <RevealOnScroll className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[.25em] text-[#77b4ff]">
                Chatham · Repair · Replace · New roof
              </p>
              <h1 className="mt-6 text-5xl font-black leading-[.93] tracking-[-.06em] sm:text-7xl">
                Show the problem before the site visit.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
                Start with the work, property and urgency. A supporting photo
                can help Primeline prepare a focused response before arranging
                the free visit.
              </p>
              <a
                className="mt-8 inline-flex items-center gap-3 rounded-lg bg-[#2575fc] px-6 py-4 text-sm font-black shadow-[0_18px_50px_-15px_#2575fc]"
                href="#visit"
              >
                <Camera className="size-4" />
                Build your roof brief
              </a>
            </RevealOnScroll>
            <RevealOnScroll
              className="relative h-[34rem] [perspective:1200px]"
              delay={100}
            >
              <div className="absolute left-[5%] right-[3%] top-[6%] h-[70%] [transform:rotateY(-18deg)_rotateX(7deg)]">
                <div className="absolute inset-x-[5%] bottom-[8%] h-[54%] bg-[#e7e9ed] shadow-[0_55px_80px_-25px_rgba(37,117,252,.45)]" />
                <div className="absolute left-0 right-0 top-[9%] h-[52%] bg-gradient-to-br from-[#51708d] to-[#151f2c] [clip-path:polygon(0_100%,42%_0,100%_100%)]" />
                <div className="absolute bottom-[8%] left-[15%] h-[32%] w-[22%] bg-[#88929c]" />
                <div className="absolute bottom-[8%] right-[13%] grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <span className="size-12 bg-[#a8c5e0]" key={i} />
                  ))}
                </div>
              </div>
              <div className="absolute right-[1%] top-[7%] rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
                <MapPin className="size-7 text-[#77b4ff]" />
                <p className="mt-3 text-xs uppercase tracking-widest text-white/45">
                  Visit brief
                </p>
                <p className="mt-1 font-black">Work · Property · Urgency</p>
              </div>
              <div className="absolute bottom-[3%] left-[3%] grid size-28 place-items-center rounded-full bg-[#2575fc] shadow-2xl [transform:translateZ(85px)]">
                <Camera className="size-11" />
              </div>
            </RevealOnScroll>
          </div>
        </section>
        <RevealOnScroll
          as="section"
          className="border-y border-white/10 bg-white/5 py-14"
        >
          <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-3 sm:px-8">
            {[
              ["01", "Choose the work"],
              ["02", "Describe the property"],
              ["03", "Add urgency and a photo"],
            ].map(([n, t]) => (
              <article key={n}>
                <p className="font-mono text-[#51a0ff]">{n}</p>
                <h2 className="mt-5 text-xl font-black">{t}</h2>
              </article>
            ))}
          </div>
        </RevealOnScroll>
        <section
          className="bg-[#f2f6fb] px-5 py-24 text-[#0b1d35] sm:px-8"
          id="visit"
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#2575fc]">
                Free site-visit route
              </p>
              <h2 className="mt-5 text-5xl font-black tracking-[-.055em]">
                Arrive knowing what to look for.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                The image control works locally for the demonstration. Nothing
                is uploaded or stored.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Primeline Roofing"
                buttonLabel="Prepare site-visit request"
                fields={fields}
                formClassName="rounded-2xl bg-white p-6 shadow-xl sm:p-9"
                successTitle="Your site-visit brief is ready"
                successMessage="A live version could send Primeline the work, building, urgency and photo context before the free site visit."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Primeline Roofing" />
    </div>
  );
}
