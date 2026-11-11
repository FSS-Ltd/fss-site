import { CarFront, Gauge, Settings2 } from "lucide-react";

import { RevealOnScroll } from "../../reveal-on-scroll";
import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { HollisMotorsHero } from "./hollis-motors-hero";

const fields = [
  {
    id: "route",
    label: "What do you need from Hollis Motors?",
    type: "select",
    options: [
      "Find a used car",
      "Value or part exchange a car",
      "Discuss finance",
      "Book an MOT or service",
      "Discuss a repair or diagnostic",
    ],
  },
  {
    id: "registration",
    label: "Vehicle registration",
    type: "registration",
    placeholder: "AB12 CDE",
  },
  { id: "mileage", label: "Mileage", type: "text", placeholder: "e.g. 42,000" },
  {
    id: "timing",
    label: "When would you like to begin?",
    type: "select",
    options: ["As soon as possible", "This week", "Within a month", "Planning ahead"],
  },
  { id: "email", label: "Email", type: "email", placeholder: "you@example.co.uk" },
] as const;

const customerRoutes = [
  {
    Icon: CarFront,
    body: "Browse the next car with part exchange and finance kept in view from the beginning.",
    title: "Sales, made clearer",
  },
  {
    Icon: Gauge,
    body: "Start the workshop conversation with the registration, mileage and work that matters.",
    title: "Aftersales, prepared",
  },
  {
    Icon: Settings2,
    body: "Separate the reason for getting in touch so the right Hollis team has useful context first.",
    title: "One useful hand-off",
  },
] as const;

export function HollisMotorsPage() {
  return (
    <div
      className="hollisPage min-h-screen overflow-clip bg-[#111214] text-white"
      data-bespoke-prospect="hollis-motors"
    >
      <ConceptBar businessName="Hollis Motors" />
      <main>
        <HollisMotorsHero />

        <RevealOnScroll
          as="section"
          className="mx-auto max-w-[88rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
          id="collection"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d85b5f]">
                A better first conversation
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                The next car and the ownership that follows.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-white/65 lg:justify-self-end">
              Hollis Motors already brings used cars, part exchange, finance and
              an onsite workshop together. This concept turns that range into a
              clearer route for every visitor.
            </p>
          </div>

          <div className="mt-12 grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-3">
            {customerRoutes.map(({ Icon, body, title }) => (
              <article className="hollisRouteCard p-7 sm:p-9" key={title}>
                <Icon aria-hidden="true" className="size-7 text-[#e36b6f]" strokeWidth={1.7} />
                <h3 className="mt-16 text-2xl font-semibold tracking-[-0.045em]">
                  {title}
                </h3>
                <p className="mt-3 max-w-sm leading-7 text-white/60">{body}</p>
              </article>
            ))}
          </div>
        </RevealOnScroll>

        <section
          className="border-y border-white/10 bg-[#18191c] px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
          id="vehicle"
        >
          <div className="mx-auto grid max-w-[78rem] gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(24rem,1.2fr)] lg:items-start lg:gap-20">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d85b5f]">
                Start with what you need
              </p>
              <h2 className="mt-5 max-w-lg text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">
                Give the right team a useful starting point.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
                A live version could keep sales, valuation and aftersales
                enquiries separate, while passing the vehicle context to the
                person who needs it.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <DemoEnquiry
                businessName="Hollis Motors"
                buttonLabel="Prepare my Hollis enquiry"
                fields={fields}
                formClassName="rounded-[2rem] bg-white p-5 text-[#171717] shadow-[0_28px_80px_-36px_rgba(0,0,0,.9)] sm:p-8"
                successMessage="A live version could route your vehicle and timing to the relevant Hollis Motors team for review."
                successTitle="Your Hollis enquiry is ready"
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <div className="bg-[#f3f1ee] text-[#171717]">
        <OwnerInvitation businessName="Hollis Motors" />
      </div>
    </div>
  );
}
