import Image from "next/image";
import {
  ArrowDownRight,
  Building,
  House,
  KeySquare,
  MapPinned,
} from "lucide-react";

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
      "Sell a property",
      "Buy a property",
      "Let a property",
      "Rent a property",
      "Request a valuation",
    ],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "text",
    placeholder: "TN17 3EB",
  },
  {
    id: "timing",
    label: "Expected timeframe",
    type: "select",
    options: [
      "Ready now",
      "Within three months",
      "Within six months",
      "Researching",
    ],
  },
  {
    id: "context",
    label: "Property context",
    type: "textarea",
    placeholder: "Property type, current position or question",
  },
] as const;

const pathways = [
  [House, "Vendors", "Prepare valuation and timing before the call."],
  [KeySquare, "Buyers", "Place location and property needs in view."],
  [
    Building,
    "Landlords and tenants",
    "Keep the letting purpose attached to the enquiry.",
  ],
  [
    MapPinned,
    "Local office",
    "Route the completed brief to the relevant team.",
  ],
] as const;

export function LegrysPage() {
  return (
    <div
      className="min-h-screen bg-[#f5f1ea] text-[#32113c]"
      data-bespoke-prospect="legrys"
    >
      <ConceptBar businessName="LeGrys" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Image
            alt="LeGrys"
            className="h-auto w-56"
            height={76}
            src="/prospect-previews/bespoke/legrys/logo.png"
            width={300}
          />
          <a
            className="inline-flex items-center gap-2 text-sm font-black text-[#4b0e58]"
            href="#property-conversation"
          >
            Choose your property route <ArrowDownRight className="size-4" />
          </a>
        </header>
        <PropertyWalkthroughHero
          accentClassName="text-[#b5c4a3]"
          actionHref="#property-conversation"
          actionLabel="Choose your property route"
          description="Route vendors, buyers, landlords and tenants by location, property and timeframe to the right local team."
          eyebrow="Cranbrook · Traditional service, evolved"
          heading="Keep the personal estate-agency service, with the property brief prepared first."
          journeyBeats={[
            {
              eyebrow: "A considered local route",
              heading: "The right conversation starts with the place.",
              description:
                "Give vendors, buyers, landlords and tenants a purposeful route from their first question.",
            },
            {
              eyebrow: "Prepared, not processed",
              heading: "A property brief with the detail that matters.",
              description:
                "Location, timing and property context remain with the enquiry from first click to reply.",
            },
          ]}
          placeLabel="Cranbrook · Kent"
        />
        <RevealOnScroll
          as="section"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {pathways.map(([Icon, title, body], index) => (
              <article
                className={`rounded-t-[4rem] rounded-b-[1.5rem] p-8 ${index % 2 === 0 ? "bg-[#647c4d] text-white" : "bg-white"}`}
                key={title}
              >
                <Icon className="size-7" />
                <p className="mt-16 font-mono text-xs opacity-55">
                  0{index + 1}
                </p>
                <h2 className="mt-4 text-3xl font-serif">{title}</h2>
                <p className="mt-3 leading-7 opacity-68">{body}</p>
              </article>
            ))}
          </div>
        </RevealOnScroll>
        <section
          className="bg-[#647c4d] px-5 py-20 text-white sm:px-8"
          id="property-conversation"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.74fr_1.26fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-white/58">
                Property conversation
              </p>
              <h2 className="mt-5 font-serif text-4xl leading-none tracking-[-.045em] sm:text-6xl">
                Personal service starts with a relevant brief.
              </h2>
            </div>
            <DemoEnquiry
              businessName="LeGrys"
              buttonLabel="Prepare property conversation"
              fields={fields}
              formClassName="rounded-t-[3rem] rounded-b-[1rem] bg-white p-6 text-[#32113c] shadow-xl sm:p-9"
              successTitle="Property route prepared"
              successMessage="A live version could route the client type, postcode, timeframe and property context to the relevant office."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="LeGrys" />
    </div>
  );
}
