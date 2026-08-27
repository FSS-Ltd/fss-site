import { Gauge, Wrench } from "lucide-react";

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
    options: [
      "Same-day MOT",
      "Car servicing",
      "Commercial vehicle servicing",
      "Motorhome MOT",
    ],
  },
  {
    id: "timing",
    label: "When do you need the workshop?",
    type: "select",
    options: ["Today", "This week", "Next week"],
  },
  {
    id: "phone",
    label: "Best contact number",
    type: "tel",
    placeholder: "07…",
  },
] as const;

export function DunkleysOfDealPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#0b0d0f] text-white"
      data-bespoke-prospect="dunkley-s-of-deal"
    >
      <div className="border-b border-white/10">
        <ConceptBar businessName="Dunkley's of Deal" />
      </div>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <span className="text-xl font-black uppercase italic tracking-tight">
          Dunkley&apos;s <span className="text-[#d6ff3f]">of Deal</span>
        </span>
        <a
          className="rounded-full bg-[#d6ff3f] px-5 py-2 text-sm font-black text-black"
          href="#vehicle"
        >
          Book by vehicle
        </a>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <RevealOnScroll>
            <p className="text-xs font-black uppercase tracking-[.24em] text-[#d6ff3f]">
              Same-day MOT · Deal
            </p>
            <h1 className="mt-6 text-5xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-7xl">
              The workshop starts with your vehicle.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
              MOTs, car servicing, commercial vehicles and motorhomes. Enter the
              registration first so the right job arrives with the right
              vehicle.
            </p>
            <div className="mt-9 flex gap-6 text-sm font-bold">
              <span className="flex items-center gap-2">
                <Gauge className="size-4 text-[#d6ff3f]" />
                Same-day MOT
              </span>
              <span className="flex items-center gap-2">
                <Wrench className="size-4 text-[#d6ff3f]" />
                Service & repair
              </span>
            </div>
          </RevealOnScroll>
          <RevealOnScroll
            className="relative h-[31rem] [perspective:1000px]"
            delay={120}
          >
            <div className="absolute left-[4%] right-[4%] top-[8%] h-[58%] rounded-[45%_55%_18%_20%] bg-gradient-to-b from-[#59616a] via-[#242a31] to-[#090b0d] shadow-[0_55px_70px_-35px_rgba(214,255,63,.35)] [transform:rotateY(-15deg)_rotateX(7deg)]">
              <div className="absolute left-[18%] top-[19%] h-[27%] w-[42%] rounded-t-[70%] bg-gradient-to-br from-[#99a9b5] to-[#1d252b]" />
              <div className="absolute bottom-[-13%] left-[12%] size-28 rounded-full border-[18px] border-[#050607] bg-[#687078] shadow-inner" />
              <div className="absolute bottom-[-13%] right-[12%] size-28 rounded-full border-[18px] border-[#050607] bg-[#687078] shadow-inner" />
              <div className="absolute bottom-[9%] right-[8%] h-8 w-[34%] rounded bg-[#d6ff3f] text-center font-mono text-xl font-black leading-8 tracking-widest text-black">
                DEAL 24
              </div>
            </div>
            <div className="absolute bottom-[2%] left-[10%] right-[10%] grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              {[
                ["01", "REG"],
                ["02", "JOB"],
                ["03", "TIME"],
              ].map(([n, l]) => (
                <div className="text-center" key={n}>
                  <p className="font-mono text-xl text-[#d6ff3f]">{n}</p>
                  <p className="mt-1 text-xs font-bold tracking-widest text-white/50">
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </section>
        <section
          className="border-y border-white/10 bg-[#111519] px-5 py-20 sm:px-8"
          id="vehicle"
        >
          <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[.7fr_1.3fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#d6ff3f]">
                Vehicle-first booking
              </p>
              <h2 className="mt-5 text-4xl font-black uppercase leading-none tracking-[-.04em] sm:text-6xl">
                No vague “contact us” loop.
              </h2>
              <p className="mt-5 text-white/60">
                This concept turns a visit into an organised workshop request
                before anyone picks up the phone.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Dunkley's of Deal"
                buttonLabel="Prepare workshop request"
                fields={fields}
                formClassName="rounded-[2rem] border border-white/10 bg-[#e8ecef] p-6 text-[#0b0d0f] shadow-2xl sm:p-9"
                successTitle="Your vehicle request is ready"
                successMessage="A live version could send the registration, job and timing to the workshop as one usable booking request."
              />
            </RevealOnScroll>
          </div>
        </section>
        <RevealOnScroll
          as="section"
          className="mx-auto grid max-w-7xl gap-4 px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-4"
        >
          {[
            "Same-day MOT",
            "Car servicing",
            "Commercial vehicles",
            "Motorhome MOT",
          ].map((item, i) => (
            <article className="min-h-44 border border-white/10 p-6" key={item}>
              <span className="font-mono text-[#d6ff3f]">0{i + 1}</span>
              <h2 className="mt-14 text-lg font-black uppercase">{item}</h2>
            </article>
          ))}
        </RevealOnScroll>
      </main>
      <OwnerInvitation businessName="Dunkley's of Deal" />
    </div>
  );
}
