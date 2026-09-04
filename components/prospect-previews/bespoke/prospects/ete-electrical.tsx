import Image from "next/image";
import {
  AlarmSmoke,
  ArrowDownRight,
  CircuitBoard,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { ElectricalCircuitBoard } from "./electrical-circuit-board";

const fields = [
  {
    id: "service",
    label: "Electrical need",
    type: "select",
    options: [
      "Electrical fault",
      "Consumer unit",
      "EICR or landlord certificate",
      "Fire alarm",
      "Lighting or sockets",
    ],
  },
  {
    id: "property",
    label: "Property",
    type: "select",
    options: [
      "Home",
      "Rental property",
      "Commercial premises",
      "Managed building",
    ],
  },
  {
    id: "timing",
    label: "Safety and timing",
    type: "select",
    options: [
      "Power or safety affected now",
      "Within seven days",
      "Planned work",
      "Seeking advice",
    ],
  },
  {
    id: "photo",
    label: "Add a useful photograph",
    type: "file",
    accept: "image/*",
  },
] as const;

const services = [
  [
    Zap,
    "Fault finding",
    "Make the affected circuit, symptoms and urgency visible first.",
  ],
  [
    ShieldCheck,
    "Inspection",
    "Prepare EICR, landlord and safety-certificate context.",
  ],
  [
    AlarmSmoke,
    "Fire alarms",
    "Route a fire-alarm need by property and project stage.",
  ],
] as const;

export function EteElectricalPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#0b0b0c] text-white"
      data-bespoke-prospect="ete-electrical"
    >
      <ElectricalCircuitBoard scope="site" />
      <ConceptBar businessName="ETE Electrical Contractors" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Image
            alt="ETE Electrical Contractors"
            className="h-auto w-36"
            height={86}
            src="/prospect-previews/bespoke/ete-electrical/logo.png"
            width={150}
          />
          <a
            className="border border-white/25 px-5 py-3 text-sm font-black uppercase tracking-wider hover:bg-white hover:text-black"
            href="#electrical-brief"
          >
            Scope the work
          </a>
        </header>

        <section className="relative isolate mx-auto grid min-h-[76svh] max-w-[96rem] overflow-hidden lg:grid-cols-[.9fr_1.1fr]">
          <div className="relative z-40 flex items-end bg-[#be1e2d] p-7 sm:p-12 lg:p-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-white/65">
                Maidstone · established 1999
              </p>
              <h1 className="mt-6 text-5xl font-black uppercase leading-[.88] tracking-[-.06em] sm:text-7xl">
                Safety first. Context before the visit.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-white/78">
                Electrical faults, inspections, landlord certificates and
                fire-alarm work, routed by the building and urgency.
              </p>
              <a
                className="mt-10 inline-flex items-center gap-3 font-black"
                href="#electrical-brief"
              >
                Prepare the job <ArrowDownRight className="size-5" />
              </a>
            </div>
          </div>
          <div className="relative z-20 min-h-[34rem]">
            <Image
              alt="An electrician inspecting a modern consumer unit"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              src="/prospect-previews/bespoke/ete-electrical/hero-v1.png"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
        </section>

        <section className="border-y border-white/10 px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex max-w-4xl items-start gap-5">
              <CircuitBoard className="mt-2 size-9 shrink-0 text-[#be1e2d]" />
              <h2 className="text-4xl font-black uppercase leading-[.95] tracking-[-.05em] sm:text-6xl">
                Different electrical jobs should not enter through the same
                blank box.
              </h2>
            </div>
            <div className="mt-14 grid gap-px bg-white/10 md:grid-cols-3">
              {services.map(([Icon, title, body]) => (
                <article className="bg-[#0b0b0c] p-7 sm:p-9" key={title}>
                  <Icon className="size-7 text-[#be1e2d]" />
                  <h3 className="mt-16 text-2xl font-black uppercase">
                    {title}
                  </h3>
                  <p className="mt-4 leading-7 text-white/58">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="grid lg:grid-cols-[.72fr_1.28fr]"
          id="electrical-brief"
        >
          <div className="bg-white p-8 text-black sm:p-12 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#be1e2d]">
              Prepared work order
            </p>
            <h2 className="mt-5 text-4xl font-black uppercase leading-none tracking-[-.05em] sm:text-6xl">
              The right questions, before the estimate.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-black/60">
              Property, service, safety and a supporting image can arrive
              together. The interaction remains a demonstration.
            </p>
          </div>
          <div className="bg-[#171719] p-5 sm:p-10 lg:p-16">
            <DemoEnquiry
              businessName="ETE Electrical Contractors"
              buttonLabel="Prepare electrical brief"
              fields={fields}
              formClassName="rounded-none border border-white/15 bg-[#efefec] p-6 text-black sm:p-9"
              successTitle="Electrical brief ready"
              successMessage="A live version could send the service, building and safety context to ETE as one reviewable enquiry."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="ETE Electrical Contractors" />
    </div>
  );
}
