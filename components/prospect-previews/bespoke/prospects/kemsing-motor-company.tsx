import { BatteryCharging, CarFront, ScanSearch, Settings2 } from "lucide-react";

import { RevealOnScroll } from "../../reveal-on-scroll";
import { ConceptBar } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { KemsingMotorCompanyHero } from "./kemsing-motor-company-hero";

const fields = [
  {
    id: "registration",
    label: "Vehicle registration",
    type: "registration",
    placeholder: "AB12 CDE",
  },
  {
    id: "service",
    label: "What does your vehicle need?",
    type: "select",
    options: [
      "MOT",
      "Service",
      "Diagnostics",
      "Repair",
      "Tyres, alignment or air conditioning",
      "EV, hybrid or ADAS calibration",
    ],
  },
  {
    id: "timing",
    label: "When would you like us to help?",
    type: "select",
    options: ["As soon as possible", "This week", "Planning ahead"],
  },
  {
    id: "contact",
    label: "Best contact details",
    type: "text",
    placeholder: "Name and telephone or email",
  },
] as const;

const serviceRoutes = [
  {
    detail: "Class 4 MOT testing and servicing for all makes.",
    Icon: CarFront,
    title: "MOT & servicing",
  },
  {
    detail: "Vehicle diagnostics to identify the work that is needed.",
    Icon: ScanSearch,
    title: "Diagnostics",
  },
  {
    detail: "Tyres, wheel alignment and air-conditioning services.",
    Icon: Settings2,
    title: "Precision care",
  },
  {
    detail: "EV and hybrid repair, plus ADAS calibration.",
    Icon: BatteryCharging,
    title: "Modern systems",
  },
] as const;

export function KemsingMotorCompanyPage() {
  return (
    <div
      className="min-h-screen bg-[#eef1f5] text-[#101722]"
      data-bespoke-prospect="kemsing-motor-company"
    >
      <ConceptBar businessName="Kemsing Motor Company" />
      <main>
        <KemsingMotorCompanyHero />

        <RevealOnScroll
          as="section"
          className="px-4 py-20 sm:px-7 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#243a7a]">
                Workshop routes
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                Choose the work. Bring the vehicle into focus.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#53606f]">
                A focused route gives Kemsing Motor Company the service context
                before the workshop follows up.
              </p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] bg-[#101722]/10 sm:grid-cols-2 lg:grid-cols-4">
              {serviceRoutes.map(({ detail, Icon, title }) => (
                <article className="bg-white p-7 sm:p-8" key={title}>
                  <Icon
                    aria-hidden="true"
                    className="size-7 text-[#243a7a]"
                    strokeWidth={1.7}
                  />
                  <h3 className="mt-14 text-2xl font-semibold tracking-[-0.045em]">
                    {title}
                  </h3>
                  <p className="mt-3 leading-7 text-[#5a6674]">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="bg-white px-4 py-20 sm:px-7 sm:py-28 lg:px-10"
        >
          <div className="mx-auto grid max-w-[78rem] gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#243a7a]">
                Kemsing Motor Company · London Road Service Station Limited
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                Established in Kemsing in 1998
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#53606f]">
                ATA Master Tech capability and continued investment in
                diagnostic equipment and technician training.
              </p>
            </div>

            <address className="rounded-[2rem] bg-[#eef1f5] p-7 not-italic sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#243a7a]">
                Workshop details
              </p>
              <p className="mt-6 text-lg font-semibold">
                9 West End, Kemsing, Kent TN15 6PX
              </p>
              <p className="mt-3 text-[#53606f]">
                Mon to Fri: 08:00am - 5:30pm
              </p>
              <div className="mt-7 grid gap-3">
                <a
                  className="font-semibold text-[#243a7a] underline decoration-[#243a7a]/25 underline-offset-4"
                  href="tel:+441732761372"
                >
                  01732 761372
                </a>
                <a
                  className="font-semibold text-[#243a7a] underline decoration-[#243a7a]/25 underline-offset-4"
                  href="mailto:info@kemsingmotorco.co.uk"
                >
                  info@kemsingmotorco.co.uk
                </a>
              </div>
            </address>
          </div>
        </RevealOnScroll>

        <section
          className="bg-[#101722] px-4 py-20 text-white sm:px-7 sm:py-28 lg:px-10"
          id="vehicle-request"
        >
          <div className="mx-auto grid max-w-[78rem] gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(32rem,1.2fr)] lg:gap-20">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e4a44a]">
                Private demonstration
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                Vehicle registration comes first.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">
                This private demonstration is not currently connected to Kemsing
                Motor Company’s live systems. It does not accept, store or send
                customer details.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/60">
                What do you need from the workshop?
              </p>
              <DemoEnquiry
                businessName="Kemsing Motor Company"
                buttonLabel="Prepare vehicle request"
                fields={fields}
                formClassName="rounded-[2rem] bg-white p-5 text-[#101722] shadow-[0_28px_80px_-36px_rgba(0,0,0,.9)] sm:p-8"
                successTitle="Your vehicle request is ready"
                successMessage="A live version could pass the registration, service, timing and contact details to Kemsing Motor Company for review."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>

      <aside className="mx-auto max-w-[78rem] px-4 py-16 sm:px-7 sm:py-24">
        <div className="rounded-[2rem] bg-[#243a7a] p-7 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e4a44a]">
            Private website concept
          </p>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            A vehicle-first enquiry route, ready to refine with Kemsing Motor
            Company.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/70">
            FSS can refine the visual direction and connect an approved journey
            to the workshop’s chosen process.
          </p>
        </div>
      </aside>
    </div>
  );
}
