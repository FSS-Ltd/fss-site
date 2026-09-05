import Image from "next/image";
import { Building2, CalendarCheck, House, KeyRound } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { PropertyWalkthroughHero } from "./property-walkthrough-hero";

const fields = [
  {
    id: "route",
    label: "Property route",
    type: "select",
    options: [
      "Rental valuation",
      "Landlord services",
      "Tenant enquiry",
      "Managed property",
      "Available property",
    ],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "text",
    placeholder: "ME4 4LZ",
  },
  {
    id: "timing",
    label: "Expected timing",
    type: "select",
    options: [
      "As soon as possible",
      "Within a month",
      "Within three months",
      "Researching",
    ],
  },
  {
    id: "details",
    label: "Property details",
    type: "textarea",
    placeholder: "Property type, bedrooms or current situation",
  },
] as const;

const routes = [
  [House, "Rental valuation", "Prepare the property before the follow-up."],
  [
    KeyRound,
    "Landlord services",
    "Make the management need clear from the start.",
  ],
  [
    Building2,
    "Tenant and property",
    "Route available-property and managed-home questions.",
  ],
  [
    CalendarCheck,
    "Expected timing",
    "Keep the move or availability date in view.",
  ],
] as const;

export function HostyLetsPage() {
  return (
    <div
      className="min-h-screen bg-[#f8f3f4] text-[#063664]"
      data-bespoke-prospect="hosty-lets"
    >
      <ConceptBar businessName="Hosty Lets" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Image
            alt="Hosty Lets"
            className="h-auto w-56"
            height={122}
            src="/prospect-previews/bespoke/hosty-lets/logo.png"
            width={1000}
          />
          <a
            className="rounded-full bg-[#063664] px-5 py-3 text-sm font-black text-white"
            href="#hosty-route"
          >
            Choose your property route
          </a>
        </header>
        <PropertyWalkthroughHero
          accentClassName="text-[#f7a3b1]"
          actionHref="#hosty-route"
          actionLabel="Choose your property route"
          description="Prepare valuations, landlord questions, tenant needs and managed-property requests with the context the Chatham team needs."
          eyebrow="Chatham · Lettings"
          heading="Route every lettings enquiry by property and purpose from the first step."
          journeyBeats={[
            {
              eyebrow: "The right route, early",
              heading: "A clearer start for every tenancy.",
              description:
                "Separate landlord, tenant, valuation and managed-property needs before the first reply.",
            },
            {
              eyebrow: "Ready for the next step",
              heading: "Property, purpose and timing. One useful brief.",
              description:
                "Share the details that give the Chatham team a useful place to begin.",
            },
          ]}
          placeLabel="Chatham · Kent"
        />
        <RevealOnScroll
          as="section"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
        >
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#c15d73]">
            Four useful turns
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {routes.map(([Icon, title, body], index) => (
              <article
                className={`rounded-[2.25rem] p-8 ${index === 0 ? "bg-[#f7a3b1]" : "bg-white"}`}
                key={title}
              >
                <Icon className="size-7" />
                <h2 className="mt-12 text-3xl font-semibold tracking-[-.04em]">
                  {title}
                </h2>
                <p className="mt-3 leading-7 text-[#063664]/62">{body}</p>
              </article>
            ))}
          </div>
        </RevealOnScroll>
        <section className="bg-[#f7a3b1] px-5 py-20 sm:px-8" id="hosty-route">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#063664]/55">
                Property intake
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                The postcode and purpose, prepared together.
              </h2>
            </div>
            <DemoEnquiry
              businessName="Hosty Lets"
              buttonLabel="Prepare property enquiry"
              fields={fields}
              formClassName="rounded-[2.5rem] bg-white p-6 shadow-xl sm:p-9"
              successTitle="Property route prepared"
              successMessage="A live version could route the purpose, postcode, timing and property detail to the lettings team."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Hosty Lets" />
    </div>
  );
}
