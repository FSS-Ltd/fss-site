import Image from "next/image";
import { Bolt, Building, Camera, HousePlug } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { ElectricalCircuitBoard } from "./electrical-circuit-board";

const fields = [
  {
    id: "route",
    label: "Work type",
    type: "select",
    options: [
      "Domestic repair",
      "Electrical installation",
      "Commercial work",
      "Ongoing maintenance",
      "Inspection or testing",
    ],
  },
  {
    id: "property",
    label: "Property",
    type: "select",
    options: [
      "House",
      "Flat",
      "Landlord property",
      "Office or shop",
      "Industrial or other",
    ],
  },
  {
    id: "urgency",
    label: "Urgency",
    type: "select",
    options: [
      "Electrical emergency",
      "This week",
      "Within a month",
      "Planning ahead",
    ],
  },
  {
    id: "details",
    label: "Job detail",
    type: "textarea",
    placeholder: "Fault, installation, inspection or maintenance need",
  },
] as const;

export function ThElectricalPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#0d0d0e] text-white"
      data-bespoke-prospect="th-electrical"
    >
      <ElectricalCircuitBoard scope="site" />
      <ConceptBar businessName="TH Electrical" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Image
            alt="TH Electrical Services Limited"
            className="h-auto w-64"
            height={250}
            src="/prospect-previews/bespoke/th-electrical/logo.webp"
            width={500}
          />
          <a
            className="rounded-full bg-[#e10600] px-5 py-3 text-sm font-black"
            href="#electrical-brief"
          >
            Start an electrical enquiry
          </a>
        </header>
        <section className="relative isolate min-h-[76svh] overflow-hidden border-y border-white/10">
          <Image
            alt="An electrician preparing a clear consumer-unit inspection brief"
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src="/prospect-previews/bespoke/th-electrical/hero-v1.png"
          />
          <div className="absolute inset-0 -z-0 bg-gradient-to-r from-black via-black/65 to-transparent" />
          <div className="relative z-40 mx-auto flex min-h-[76svh] max-w-7xl items-center px-5 py-16 sm:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#ef5b56]">
                Sissinghurst · Domestic and commercial
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[.89] tracking-[-.06em] sm:text-7xl">
                Give the electrical team the property and job context before the
                first call.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">
                Route domestic, commercial and maintenance work by need, urgency
                and timing for a more useful first response.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-5 lg:grid-cols-12">
            <article className="rounded-[2rem] border border-white/12 p-8 lg:col-span-5">
              <HousePlug className="size-7 text-[#e10600]" />
              <h2 className="mt-16 text-4xl font-semibold tracking-[-.045em]">
                Domestic work starts with the property and the fault.
              </h2>
            </article>
            <article className="rounded-[2rem] bg-[#e10600] p-8 lg:col-span-7">
              <Building className="size-7" />
              <h2 className="mt-16 text-4xl font-semibold tracking-[-.045em]">
                Commercial and maintenance needs follow a separate route.
              </h2>
            </article>
            <article className="rounded-[2rem] bg-white p-8 text-black lg:col-span-7">
              <Bolt className="size-7 text-[#e10600]" />
              <h2 className="mt-16 text-4xl font-semibold tracking-[-.045em]">
                Urgency is visible before attendance is discussed.
              </h2>
            </article>
            <article className="rounded-[2rem] border border-white/12 p-8 lg:col-span-5">
              <Camera className="size-7 text-[#e10600]" />
              <h2 className="mt-16 text-4xl font-semibold tracking-[-.045em]">
                A live route can add one useful project image.
              </h2>
            </article>
          </div>
        </section>
        <section
          className="bg-[#e10600] px-5 py-20 sm:px-8"
          id="electrical-brief"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-black/55">
                Job triage
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                The right questions, switched on in order.
              </h2>
            </div>
            <DemoEnquiry
              businessName="TH Electrical"
              buttonLabel="Prepare electrical brief"
              fields={fields}
              formClassName="rounded-[.75rem] bg-white p-6 text-slate-950 shadow-[12px_12px_0_#0d0d0e] sm:p-9"
              successTitle="Electrical brief prepared"
              successMessage="A live version could combine work type, property, urgency and job detail for the team."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="TH Electrical" />
    </div>
  );
}
