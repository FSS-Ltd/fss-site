import Image from "next/image";
import { Building2, Camera, ClipboardCheck, Waves } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { RoofBuildScrollHero } from "./roof-build-scroll-hero";

const fields = [
  {
    id: "service",
    label: "What does the roof need?",
    type: "select",
    options: [
      "Urgent repair",
      "Roof replacement",
      "New roof",
      "Industrial or specified work",
    ],
  },
  {
    id: "property",
    label: "Property or project type",
    type: "select",
    options: [
      "Home",
      "Commercial building",
      "Industrial site",
      "Public or managed property",
    ],
  },
  {
    id: "timing",
    label: "How soon?",
    type: "select",
    options: [
      "Water is entering now",
      "Within two weeks",
      "Within three months",
      "Planning ahead",
    ],
  },
  {
    id: "evidence",
    label: "Add roof photos or a drawing",
    type: "file",
    accept: "image/*,.pdf",
  },
] as const;

const routes = [
  {
    icon: Waves,
    name: "Flat systems",
    detail: "Felt, GRP, single ply, green roofs and specialist waterproofing.",
  },
  {
    icon: Building2,
    name: "Pitched roofs",
    detail: "Slate, tile, lead, zinc, insulation and ventilation.",
  },
  {
    icon: ClipboardCheck,
    name: "Specified work",
    detail:
      "Industrial projects, detailed drawings and technical roof systems.",
  },
] as const;

export function TunbridgeWellsRoofingPage() {
  return (
    <div
      className="min-h-screen bg-[#f2f5f7] text-[#101820]"
      data-bespoke-prospect="tunbridge-wells-roofing"
    >
      <ConceptBar businessName="Tunbridge Wells Roofing" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
          <Image
            alt="Tunbridge Wells Roofing Limited"
            className="h-auto w-56"
            height={127}
            src="/prospect-previews/bespoke/tunbridge-wells-roofing/logo.png"
            width={416}
          />
          <a
            className="rounded-full bg-[#101820] px-5 py-3 text-sm font-bold text-white"
            href="#roof-brief"
          >
            Prepare a roof brief
          </a>
        </header>

        <RoofBuildScrollHero
          accentClassName="text-[#00aeea]"
          assessmentHref="#roof-brief"
          assessmentLabel="Start the assessment"
          businessName="Tunbridge Wells Roofing"
          eyebrow="Flat · pitched · industrial · specialist"
          heading="The roof assessment starts with the property."
          summary="Choose the work, add the roof system and show the urgency before the first call. Drawings and photographs can arrive with the brief."
        />

        <RevealOnScroll
          as="section"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"
        >
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#008fc4]">
                Roofing routes
              </p>
              <h2 className="mt-5 text-4xl font-black leading-none tracking-[-.055em] sm:text-6xl">
                Technical range, simpler first step.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              The service range is broad. The enquiry does not need to be. Each
              route begins with the information that makes a site response more
              useful.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {routes.map(({ icon: Icon, name, detail }, index) => (
              <div
                className="h-full"
                data-roofing-route-reveal="true"
                key={name}
              >
                <RevealOnScroll className="h-full" delay={index * 130}>
                  <article className="h-full rounded-[2rem] border border-slate-950/10 bg-white p-7 shadow-[0_30px_90px_-60px_rgba(16,24,32,.7)]">
                    <span className="text-sm font-black text-[#00aeea]">
                      0{index + 1}
                    </span>
                    <Icon className="mt-14 size-7" />
                    <h3 className="mt-5 text-2xl font-black tracking-tight">
                      {name}
                    </h3>
                    <p className="mt-3 leading-7 text-slate-600">{detail}</p>
                  </article>
                </RevealOnScroll>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="grid bg-[#00aeea] lg:grid-cols-[.76fr_1.24fr]"
          id="roof-brief"
        >
          <div className="flex flex-col justify-between p-8 text-[#101820] sm:p-12 lg:p-16">
            <div>
              <Camera className="size-9" />
              <h2 className="mt-8 text-4xl font-black leading-none tracking-[-.055em] sm:text-6xl">
                Show the roof before the visit.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8">
                A live version could send service, property, urgency and visual
                evidence as one organised assessment request.
              </p>
            </div>
            <p className="mt-16 text-sm font-bold">
              Demonstration only. No details are transmitted.
            </p>
          </div>
          <div className="bg-[#e9eef1] p-5 sm:p-10 lg:p-16">
            <DemoEnquiry
              businessName="Tunbridge Wells Roofing"
              buttonLabel="Prepare roofing assessment"
              fields={fields}
              formClassName="rounded-[2rem] bg-white p-6 shadow-2xl sm:p-9"
              successTitle="Roofing brief prepared"
              successMessage="A live version could route this property, roof and urgency context to the team before a site visit is arranged."
            />
          </div>
        </RevealOnScroll>
      </main>
      <OwnerInvitation businessName="Tunbridge Wells Roofing" />
    </div>
  );
}
