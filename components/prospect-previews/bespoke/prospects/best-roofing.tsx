import Image from "next/image";
import { Camera, Clock3, House, MapPin } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { RoofBuildScrollHero } from "./roof-build-scroll-hero";

const fields = [
  {
    id: "service",
    label: "Roofing service",
    type: "select",
    options: [
      "Roof repair",
      "New roof",
      "Flat roof",
      "Leadwork",
      "Roofline",
      "Chimney care",
    ],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "text",
    placeholder: "Kent postcode",
  },
  {
    id: "urgency",
    label: "When is help needed?",
    type: "select",
    options: [
      "Emergency make-safe",
      "This week",
      "Within a month",
      "Planning ahead",
    ],
  },
  {
    id: "details",
    label: "What can you see?",
    type: "textarea",
    placeholder: "Leak, missing tile, chimney or roofline detail",
  },
] as const;

const route = [
  [
    House,
    "Choose the roof",
    "Repair, replacement, flat roofing, leadwork or chimney.",
  ],
  [
    MapPin,
    "Place the property",
    "Add the postcode before arranging a site survey.",
  ],
  [
    Clock3,
    "Set the urgency",
    "Separate active leaks from planned improvements.",
  ],
  [
    Camera,
    "Show the detail",
    "A live journey could accept a useful roof photograph.",
  ],
] as const;

export function BestRoofingPage() {
  return (
    <div
      className="min-h-screen bg-[#f3f0e9] text-[#0d334a]"
      data-bespoke-prospect="best-roofing"
    >
      <ConceptBar businessName="Best Roofing Ltd" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Image
            alt="Best Roofing Ltd"
            className="size-20 rounded-2xl"
            height={512}
            src="/prospect-previews/bespoke/best-roofing/logo.png"
            width={512}
          />
          <a
            className="rounded-full bg-[#dc554f] px-5 py-3 text-sm font-black text-white"
            href="#roofing-brief"
          >
            Start a roof assessment
          </a>
        </header>
        <RoofBuildScrollHero
          accentClassName="text-[#f19a91]"
          assessmentHref="#roofing-brief"
          assessmentLabel="Start the assessment"
          businessName="Best Roofing Ltd"
          eyebrow="Canterbury · Roofing surveys"
          heading="Start the right roofing survey with the problem already in view."
          summary="Choose the roof service, add property context and prepare a useful survey request for the Canterbury team."
        />
        <RevealOnScroll
          as="section"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
        >
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#dc554f]">
            A survey-ready route
          </p>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {route.map(([Icon, title, body], index) => (
              <div
                className="h-full"
                data-roofing-route-reveal="true"
                key={title}
              >
                <RevealOnScroll className="h-full" delay={index * 110}>
                  <article className="h-full rounded-[1.75rem] bg-white p-7 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Icon className="size-6 text-[#dc554f]" />
                      <span className="font-mono text-xs text-[#0d334a]/40">
                        0{index + 1}
                      </span>
                    </div>
                    <h2 className="mt-14 text-xl font-black">{title}</h2>
                    <p className="mt-3 leading-7 text-[#0d334a]/62">{body}</p>
                  </article>
                </RevealOnScroll>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        <RevealOnScroll
          as="section"
          className="bg-[#dc554f] px-5 py-20 sm:px-8"
          id="roofing-brief"
        >
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div className="text-white">
              <p className="text-xs font-black uppercase tracking-[.22em] text-white/65">
                Review-only enquiry
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.05em] sm:text-6xl">
                A clearer brief before the ladder comes off the van.
              </h2>
            </div>
            <DemoEnquiry
              businessName="Best Roofing Ltd"
              buttonLabel="Prepare roofing request"
              fields={fields}
              formClassName="rounded-[2rem] bg-white p-6 text-[#0d334a] shadow-2xl sm:p-9"
              successTitle="Roofing brief prepared"
              successMessage="A live version could route the service, postcode, urgency and roof detail to the survey team."
            />
          </div>
        </RevealOnScroll>
      </main>
      <OwnerInvitation businessName="Best Roofing Ltd" />
    </div>
  );
}
