import Image from "next/image";
import { ArrowDown } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import {
  InteractiveJourney,
  type JourneyStep,
} from "../interactive-journey";

const fields = [
  {
    id: "service",
    label: "Landscape need",
    type: "select",
    options: [
      "Landscape design",
      "Planning support",
      "Biodiversity Net Gain",
      "Show-garden visit",
    ],
  },
  {
    id: "stage",
    label: "Project stage",
    type: "select",
    options: [
      "Site selection",
      "Pre-application",
      "Planning submitted",
      "Detailed design",
      "On site",
    ],
  },
  {
    id: "location",
    label: "Site location",
    type: "text",
    placeholder: "Town or postcode",
  },
  {
    id: "context",
    label: "What should the first conversation know?",
    type: "textarea",
    placeholder: "Development, planning and site context",
  },
] as const;

const journeySteps: readonly JourneyStep[] = [
  {
    description: "Bring the site stage, constraints and professional team into view at the start.",
    icon: "compass",
    id: "planning",
    nextStep: "The first discussion can begin with the planning and design context already understood.",
    number: "01",
    title: "Planning and design",
  },
  {
    description: "Frame site selection, proposals and mitigation before the BNG conversation begins.",
    icon: "sprout",
    id: "bng",
    nextStep: "The practice can identify the relevant ecological and delivery questions sooner.",
    number: "02",
    title: "Biodiversity Net Gain",
  },
  {
    description: "A visit has a different purpose from a development or planning conversation.",
    icon: "flower",
    id: "garden",
    nextStep: "The request arrives with enough context to arrange the right kind of visit.",
    number: "03",
    title: "Show garden",
  },
  {
    description: "Retain the landscape intent as a project moves from a drawn proposal toward a built place.",
    icon: "leaf",
    id: "delivery",
    nextStep: "The team can begin with the project phase and the discipline required.",
    number: "04",
    title: "Delivery",
  },
];

export function HillWoodPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f4f2eb] text-[#17244b]"
      data-bespoke-prospect="hill-wood"
    >
      <ConceptBar businessName="Hill-Wood & Co" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Image
            alt="Hill-Wood and Company"
            className="h-auto w-28"
            height={400}
            src="/prospect-previews/bespoke/hill-wood/logo.webp"
            width={400}
          />
          <a
            className="text-sm font-bold underline decoration-[#6c8654] decoration-2 underline-offset-8"
            href="#landscape-brief"
          >
            Begin with the site
          </a>
        </header>
        <section className="mx-auto grid max-w-[96rem] gap-0 px-3 pb-3 lg:grid-cols-[.73fr_1.27fr]">
          <div className="flex items-end rounded-t-[5rem] bg-[#17244b] p-7 text-white sm:p-12 lg:rounded-bl-[5rem] lg:rounded-tr-none lg:p-16">
            <div data-prospect-hero-copy="true">
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#a8c08e]">
                Chartered landscape architects
              </p>
              <h1 className="mt-7 text-5xl font-medium leading-[.92] tracking-[-.065em] sm:text-7xl">
                From planning context to planted place.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-white/68">
                Landscape design, Biodiversity Net Gain and development support
                can start with the site and its stage already understood.
              </p>
              <a
                className="mt-10 inline-flex items-center gap-3 font-bold text-[#b9d49c]"
                href="#practice-routes"
              >
                Explore the route <ArrowDown className="size-4" />
              </a>
            </div>
          </div>
          <div className="relative min-h-[72svh] overflow-hidden rounded-b-[5rem] lg:rounded-bl-none lg:rounded-tr-[5rem]">
            <Image
              alt="A landscape architect reviewing plans in a completed show garden"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 64vw, 100vw"
              src="/prospect-previews/bespoke/hill-wood/hero-v1.png"
            />
          </div>
        </section>

        <section
          className="bg-[#17244b] px-5 py-20 text-white sm:px-8 sm:py-28"
          id="practice-routes"
        >
          <div className="mx-auto max-w-7xl">
            <InteractiveJourney
              ariaLabel="Landscape practice routes"
              description="Select a route to see the context that would make a first conversation more useful."
              eyebrow="Practice routes"
              heading="The site tells the first part of the brief."
              steps={journeySteps}
            />
          </div>
        </section>

        <section
          className="grid bg-[#dfe6d7] lg:grid-cols-[.7fr_1.3fr]"
          id="landscape-brief"
        >
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#56703f]">
              Project discovery
            </p>
            <h2 className="mt-5 text-4xl font-medium leading-none tracking-[-.055em] sm:text-6xl">
              Prepare the landscape conversation.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-[#17244b]/62">
              A concise intake can make the site, planning position and required
              discipline clear before a consultation.
            </p>
          </div>
          <div className="p-5 sm:p-10 lg:p-16">
            <DemoEnquiry
              businessName="Hill-Wood & Co"
              buttonLabel="Prepare landscape brief"
              fields={fields}
              formClassName="rounded-[3rem_1rem] bg-white p-6 shadow-[0_35px_100px_-70px_rgba(23,36,75,.9)] sm:p-9"
              successTitle="Landscape brief prepared"
              successMessage="A live version could send the site, stage and landscape need as one considered first brief."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Hill-Wood & Co" />
    </div>
  );
}
