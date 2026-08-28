import Image from "next/image";
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
      <main>
        <section data-dunkley-scroll-hero="true">
          <div data-dunkley-scroll-hero-frame="true">
            <Image
              alt="A vehicle prepared for service in a contemporary workshop"
              data-dunkley-scroll-hero-media="true"
              fill
              priority
              sizes="100vw"
              src="/prospect-previews/bespoke/dunkley-s-of-deal/hero-v1.png"
            />
            <div aria-hidden="true" data-dunkley-scroll-hero-shade="true" />
            <div
              className="relative z-10 border-b border-white/10"
              data-dunkley-scroll-hero-chrome="true"
            >
              <ConceptBar businessName="Dunkley's of Deal" />
            </div>
            <header
              className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8"
              data-dunkley-scroll-hero-chrome="true"
            >
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
            <div
              className="relative z-10 mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-7xl items-end px-5 pb-14 pt-8 sm:px-8 sm:pb-20"
              data-dunkley-scroll-hero-copy="true"
            >
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[.24em] text-[#d6ff3f]">
                  Same-day MOT · Deal
                </p>
                <h1 className="mt-6 text-5xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-7xl">
                  The workshop starts with your vehicle.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
                  MOTs, car servicing, commercial vehicles and motorhomes. Enter
                  the registration first so the right job arrives with the right
                  vehicle.
                </p>
                <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Gauge className="size-4 text-[#d6ff3f]" />
                    Same-day MOT
                  </span>
                  <span className="flex items-center gap-2">
                    <Wrench className="size-4 text-[#d6ff3f]" />
                    Service & repair
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className="border-y border-white/10 bg-[#111519] px-5 py-20 sm:px-8"
          id="vehicle"
        >
          <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[.7fr_1.3fr]">
            <div>
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
            </div>
            <div>
              <DemoEnquiry
                businessName="Dunkley's of Deal"
                buttonLabel="Prepare workshop request"
                fields={fields}
                formClassName="rounded-[2rem] border border-white/10 bg-[#e8ecef] p-6 text-[#0b0d0f] shadow-2xl sm:p-9"
                successTitle="Your vehicle request is ready"
                successMessage="A live version could send the registration, job and timing to the workshop as one usable booking request."
              />
            </div>
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
