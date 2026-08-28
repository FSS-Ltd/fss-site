import { CircleAlert, Flame, Wrench } from "lucide-react";

import { ConceptBar } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { JaguarWaterJourneyHero } from "./jaguar-water-journey-hero";

const fields = [
  {
    id: "service",
    label: "What needs attention?",
    type: "select",
    options: [
      "Emergency callout",
      "Plumbing repair or installation",
      "Boiler or heating work",
      "Drainage issue",
      "Planned project",
    ],
  },
  {
    id: "timing",
    label: "How soon do you need help?",
    type: "select",
    options: ["As soon as possible", "This week", "I am planning ahead"],
  },
  {
    id: "property",
    label: "Where is the work needed?",
    type: "select",
    options: ["Home", "Business or commercial property"],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "postcode",
    placeholder: "DA1…",
  },
] as const;

const serviceAreas = [
  {
    title: "Plumbing",
    detail: "Repairs, installations and everyday plumbing work.",
    Icon: Wrench,
  },
  {
    title: "Heating",
    detail: "Boiler, gas and central-heating work, routed with context.",
    Icon: Flame,
  },
  {
    title: "Drainage",
    detail: "Unblocking, repair and investigation when water will not move.",
    Icon: CircleAlert,
  },
] as const;

export function JaguarPlumbingPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f2f2ef] text-[#121619]"
      data-bespoke-prospect="jaguar-plumbing"
    >
      <ConceptBar businessName="Jaguar Plumbing" />
      <main>
        <JaguarWaterJourneyHero />

        <RevealOnScroll as="section" className="px-4 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-[88rem]">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d85c07]">
                One team. Three disciplines.
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                Make the first conversation count.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#53595b]">
                The service route changes the questions early, so Jaguar can
                understand the job before deciding what happens next.
              </p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] bg-black/10 md:grid-cols-3">
              {serviceAreas.map(({ Icon, detail, title }) => (
                <article className="bg-[#f8f8f5] p-7 sm:p-9" key={title}>
                  <Icon aria-hidden="true" className="size-6 text-[#e56c05]" strokeWidth={1.7} />
                  <h3 className="mt-16 text-2xl font-semibold tracking-[-0.045em]">
                    {title}
                  </h3>
                  <p className="mt-3 max-w-xs leading-7 text-[#606668]">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <section className="bg-[#e7e7e1] px-4 py-20 sm:px-7 sm:py-28 lg:px-10" id="service-brief">
          <div className="mx-auto grid max-w-[76rem] gap-12 lg:grid-cols-[minmax(0,.82fr)_minmax(32rem,1.18fr)] lg:gap-20">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d85c07]">
                A clearer first step
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                Four details. A more useful response.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-[#51585a]">
                A live version could pass the service, urgency, property type
                and postcode to the Jaguar team. This private concept does not
                accept or send enquiries.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={100}>
              <DemoEnquiry
                businessName="Jaguar Plumbing"
                buttonLabel="Prepare service brief"
                fields={fields}
                formClassName="rounded-[2rem] bg-white p-5 text-[#15191b] shadow-[0_28px_70px_-34px_rgba(17,21,23,.34)] sm:p-8"
                successTitle="Your service brief is ready"
                successMessage="A live version could give Jaguar the service, urgency, property type and postcode before arranging the right follow-up."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <aside className="mx-auto max-w-[76rem] px-4 py-16 sm:px-7 sm:py-24">
        <div className="rounded-[2rem] bg-[#111517] p-7 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f39200]">
            A private concept for Jaguar Plumbing
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                A first enquiry designed around the work, not a generic contact form.
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-white/65">
                FSS can refine the concept with Jaguar, then connect it to the
                team’s preferred workflow when they are ready.
              </p>
            </div>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111517] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              href="mailto:hello@faithfulsoftware.dev"
            >
              Discuss this concept
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
