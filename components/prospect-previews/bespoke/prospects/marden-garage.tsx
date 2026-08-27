import { CarFront, CircleGauge } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "registration",
    label: "Vehicle registration",
    type: "registration",
    placeholder: "AB12 CDE",
  },
  {
    id: "service",
    label: "What do you need?",
    type: "select",
    options: ["MOT", "Service", "Repair"],
  },
  {
    id: "timing",
    label: "When would you like to visit?",
    type: "select",
    options: ["This week", "Next week", "I am flexible"],
  },
  { id: "phone", label: "Contact number", type: "tel", placeholder: "07…" },
] as const;

export function MardenGaragePage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#e7f5f6] text-[#103f46]"
      data-bespoke-prospect="marden-garage"
    >
      <ConceptBar businessName="Marden Garage" />
      <main>
        <section className="relative mx-auto max-w-[96rem] overflow-hidden rounded-[0_0_4rem_4rem] bg-[#226d7a] text-white">
          <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-7 sm:px-8">
            <span className="text-xl font-black tracking-tight">
              MARDEN<span className="font-light text-[#b0e0e9]"> GARAGE</span>
            </span>
            <a
              className="rounded-full bg-[#b0e0e9] px-5 py-2 text-sm font-black text-[#103f46]"
              href="#booking"
            >
              Start a request
            </a>
          </header>
          <div className="mx-auto grid min-h-[74vh] max-w-7xl items-center gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1fr_1fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.23em] text-[#b0e0e9]">
                MOT · Service · Repair
              </p>
              <h1 className="mt-6 text-5xl font-black leading-[.93] tracking-[-.06em] sm:text-7xl">
                Your registration is the fastest way in.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
                Start with the vehicle. Marden Garage can then see whether it is
                an MOT, service or repair before arranging the workshop visit.
              </p>
              <a
                className="mt-8 inline-flex rounded-full bg-white px-6 py-4 text-sm font-black text-[#226d7a]"
                href="#booking"
              >
                Enter your registration
              </a>
            </RevealOnScroll>
            <RevealOnScroll
              className="relative h-[32rem] [perspective:1200px]"
              delay={100}
            >
              <div className="absolute left-[7%] right-[7%] top-[12%] h-[64%] rounded-[3rem] border border-white/20 bg-gradient-to-br from-white/20 to-[#124954] shadow-[0_50px_90px_-30px_rgba(3,29,33,.7)] [transform:rotateY(12deg)_rotateX(5deg)]">
                <div className="absolute left-[12%] right-[12%] top-[15%] h-[43%] rounded-[45%_55%_20%_20%] bg-gradient-to-b from-[#c9f0f4] to-[#467782]" />
                <div className="absolute bottom-[12%] left-[9%] right-[9%] h-[23%] rounded-3xl bg-[#102f35]" />
                <div className="absolute bottom-[16%] left-[28%] right-[28%] h-12 rounded-lg bg-[#f6d64a] text-center font-mono text-2xl font-black leading-[3rem] tracking-[.15em] text-black">
                  MOT 26
                </div>
              </div>
              <div className="absolute bottom-[2%] right-[2%] grid size-28 place-items-center rounded-full bg-[#b0e0e9] text-[#226d7a] shadow-2xl [transform:translateZ(80px)]">
                <CircleGauge className="size-11" />
              </div>
              <div className="absolute left-0 top-[8%] rounded-2xl bg-white/90 p-5 text-[#103f46] shadow-xl">
                <p className="text-xs font-bold uppercase tracking-widest opacity-55">
                  First field
                </p>
                <p className="mt-1 font-mono text-xl font-black tracking-wider">
                  YOUR REG
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </section>
        <RevealOnScroll
          as="section"
          className="mx-auto grid max-w-7xl gap-5 px-5 py-16 sm:grid-cols-3 sm:px-8"
        >
          {[
            ["MOT", "Book the test route"],
            ["SERVICE", "Prepare routine work"],
            ["REPAIR", "Describe the warning signs"],
          ].map(([a, b]) => (
            <article className="rounded-[2rem] bg-white p-7 shadow-sm" key={a}>
              <CarFront className="size-6 text-[#226d7a]" />
              <h2 className="mt-10 text-2xl font-black">{a}</h2>
              <p className="mt-2 text-[#527077]">{b}</p>
            </article>
          ))}
        </RevealOnScroll>
        <section className="px-5 py-16 sm:px-8" id="booking">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.75fr_1.25fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#226d7a]">
                Workshop-ready request
              </p>
              <h2 className="mt-5 text-4xl font-black tracking-[-.04em] sm:text-6xl">
                Four details. One useful follow-up.
              </h2>
              <p className="mt-5 leading-7 text-[#527077]">
                The demo starts with registration by design, so the request is
                about a known vehicle from the beginning.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Marden Garage"
                buttonLabel="Prepare vehicle request"
                fields={fields}
                formClassName="rounded-[2.5rem] bg-white p-6 shadow-xl sm:p-9"
                successTitle="Your workshop request is ready"
                successMessage="A live version could send the vehicle, service and timing to Marden Garage as a structured request."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Marden Garage" />
    </div>
  );
}
