import Image from "next/image";
import { Building, Compass, House, Waves } from "lucide-react";

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
      "Request a valuation",
      "Sell a home",
      "Let a property",
      "Book a viewing",
      "Existing client update",
    ],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "postcode",
    placeholder: "CT14",
  },
  {
    id: "property",
    label: "Property type",
    type: "select",
    options: ["House", "Flat", "Bungalow", "New home", "Other"],
  },
  {
    id: "timing",
    label: "Move or letting timing",
    type: "select",
    options: [
      "As soon as possible",
      "Within three months",
      "Later this year",
      "Still deciding",
    ],
  },
] as const;

export function JenkinsonEstatesPage() {
  return (
    <div
      className="min-h-screen bg-[#f2f0ea] text-[#102b3f]"
      data-bespoke-prospect="jenkinson-estates"
    >
      <ConceptBar businessName="Jenkinson Estates" />
      <main>
        <header className="bg-[#102b3f] px-5 py-6 text-white sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
            <Image
              alt="Jenkinson Estates"
              className="h-auto w-64"
              height={120}
              src="/prospect-previews/bespoke/jenkinson-estates/logo.png"
              width={480}
            />
            <a
              className="border-b border-white/60 pb-1 text-sm font-bold"
              href="#deal-property"
            >
              Begin a property conversation
            </a>
          </div>
        </header>
        <PropertyWalkthroughHero
          accentClassName="text-[#dce4e7]"
          actionHref="#deal-property"
          actionLabel="Prepare the move"
          description="Sales, lettings, valuations and viewings, separated clearly while keeping Jenkinson's local, independent approach."
          eyebrow="Independent · Deal"
          heading="The next move begins with the right property context."
          journeyBeats={[
            {
              eyebrow: "A clear route through the move",
              heading: "Sales, lettings and viewings, each with their place.",
              description:
                "Start the conversation in the right part of the property journey, from the first enquiry.",
            },
            {
              eyebrow: "Prepared for a useful reply",
              heading: "Property, postcode and timing. Together.",
              description:
                "Keep the move context close, then give the right Jenkinson team a clear next step.",
            },
          ]}
          placeLabel="Deal · Kent coast"
        />

        <RevealOnScroll
          as="section"
          className="bg-white px-5 py-20 sm:px-8 sm:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.68fr_1.32fr]">
              <div>
                <Compass className="size-8 text-[#718d9c]" />
                <h2 className="mt-6 text-4xl font-light leading-none tracking-[-.05em] sm:text-6xl">
                  One agency, distinct journeys.
                </h2>
              </div>
              <div className="grid gap-px bg-[#102b3f]/10 sm:grid-cols-3">
                {[
                  [House, "Sales", "Value, market and move timing."],
                  [
                    Building,
                    "Lettings",
                    "Property, occupancy and instruction.",
                  ],
                  [
                    Waves,
                    "Existing clients",
                    "Progression and tenancy updates kept separate.",
                  ],
                ].map(([Icon, title, body]) => (
                  <article className="bg-white p-7" key={String(title)}>
                    {typeof Icon !== "string" ? (
                      <Icon className="size-6 text-[#718d9c]" />
                    ) : null}
                    <h3 className="mt-16 text-2xl font-semibold">
                      {title as string}
                    </h3>
                    <p className="mt-3 leading-7 text-[#102b3f]/58">
                      {body as string}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScroll>

        <section
          className="grid bg-[#dce4e7] lg:grid-cols-[.72fr_1.28fr]"
          id="deal-property"
        >
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#526f7d]">
              A prepared conversation
            </p>
            <h2 className="mt-5 text-4xl font-light leading-none tracking-[-.05em] sm:text-6xl">
              Property, postcode and timing, together.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#102b3f]/62">
              This review-only interaction demonstrates how a more relevant
              first reply could begin.
            </p>
          </div>
          <div className="p-5 sm:p-10 lg:p-16">
            <DemoEnquiry
              businessName="Jenkinson Estates"
              buttonLabel="Prepare property conversation"
              fields={fields}
              formClassName="rounded-[.75rem] bg-white p-6 shadow-[0_30px_100px_-60px_rgba(16,43,63,.8)] sm:p-9"
              successTitle="Property conversation prepared"
              successMessage="A live version could route this move, property and timing context to the right Jenkinson team."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Jenkinson Estates" />
    </div>
  );
}
