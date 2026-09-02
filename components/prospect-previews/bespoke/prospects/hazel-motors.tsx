import Image from "next/image";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import {
  InteractiveJourney,
  type JourneyStep,
} from "../interactive-journey";

const fields = [
  {
    id: "registration",
    label: "Vehicle registration",
    type: "text",
    placeholder: "AB12 CDE",
  },
  {
    id: "service",
    label: "Workshop service",
    type: "select",
    options: [
      "MOT",
      "Servicing",
      "Repair",
      "Tyres and alignment",
      "Diagnostics",
    ],
  },
  {
    id: "timing",
    label: "Preferred timing",
    type: "select",
    options: ["As soon as possible", "This week", "Next week", "Flexible"],
  },
  {
    id: "symptoms",
    label: "Vehicle symptoms",
    type: "textarea",
    placeholder: "Warning lights, noise, vibration or other detail",
  },
] as const;

const journeySteps: readonly JourneyStep[] = [
  {
    description: "A registration gives the team a concrete vehicle to discuss from the first response.",
    icon: "car",
    id: "identify",
    nextStep: "The workshop can recognise the vehicle before asking what support it needs.",
    number: "01",
    title: "Identify the vehicle",
  },
  {
    description: "MOT, servicing, repair, tyres and diagnostics need different first questions.",
    icon: "wrench",
    id: "route",
    nextStep: "The request reaches the relevant workshop route rather than a generic inbox.",
    number: "02",
    title: "Route the service",
  },
  {
    description: "Warning lights, noises and vibration become useful context in the driver’s own words.",
    icon: "gauge",
    id: "explain",
    nextStep: "The first conversation starts with the symptom, not a request to explain it again.",
    number: "03",
    title: "Explain the symptom",
  },
  {
    description: "A timing preference makes space for both urgent work and planned maintenance.",
    icon: "calendar-clock",
    id: "schedule",
    nextStep: "The team can respond with an appropriate appointment option.",
    number: "04",
    title: "Set the timing",
  },
];

export function HazelMotorsPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#e9edf2] text-[#172c68]"
      data-bespoke-prospect="hazel-motors"
    >
      <ConceptBar businessName="Hazel Motors" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Image
            alt="Hazel Motors"
            className="h-20 w-auto"
            height={436}
            src="/prospect-previews/bespoke/hazel-motors/logo.png"
            width={295}
          />
          <a
            className="rounded-md bg-[#172c68] px-5 py-3 text-sm font-black text-white"
            href="#workshop-intake"
          >
            Book by vehicle
          </a>
        </header>
        <section className="relative min-h-[78svh] bg-[#10172c] text-white">
          <Image
            alt="A vehicle service inspection in an established independent workshop"
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src="/prospect-previews/bespoke/hazel-motors/hero-v1.png"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1123] via-[#0a1123]/72 to-transparent" />
          <div className="relative mx-auto flex min-h-[78svh] max-w-7xl items-end px-5 py-14 sm:px-8 lg:py-20">
            <div className="max-w-3xl" data-prospect-hero-copy="true">
              <p className="text-xs font-black uppercase tracking-[.25em] text-[#aeb7c9]">
                Chatham · Since 1976
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[.9] tracking-[-.06em] sm:text-7xl">
                Begin every workshop request with the vehicle, not a blank
                message.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/68">
                Use the registration to route MOT, servicing, repair, tyre and
                diagnostic needs with the right context attached.
              </p>
            </div>
          </div>
        </section>
        <section className="bg-[#172c68] px-5 py-20 text-white sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <InteractiveJourney
              ariaLabel="Vehicle service journey"
              description="Select a step to see how a vehicle-led request improves the team’s first response."
              eyebrow="Workshop journey"
              heading="A useful request moves with the vehicle."
              steps={journeySteps}
            />
          </div>
        </section>
        <section
          className="bg-[#172c68] px-5 py-20 sm:px-8"
          id="workshop-intake"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-center">
            <div className="text-white">
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#aeb7c9]">
                Workshop intake
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                The useful questions, before the bonnet opens.
              </h2>
            </div>
            <DemoEnquiry
              businessName="Hazel Motors"
              buttonLabel="Prepare workshop request"
              fields={fields}
              formClassName="rounded-[2rem] bg-white p-6 text-[#172c68] sm:p-9"
              successTitle="Workshop request prepared"
              successMessage="A live version could send the registration, service, timing and symptoms as one organised brief."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Hazel Motors" />
    </div>
  );
}
