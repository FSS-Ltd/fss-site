import type { LucideIcon } from "lucide-react";
import { Camera, ClipboardCheck, Home, ShieldCheck } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { PrimelineRoofingHero } from "./primeline-roofing-hero";

type ProofPoint = {
  body: string;
  icon: LucideIcon;
  title: string;
};

const fields = [
  {
    id: "work",
    label: "What work do you need?",
    type: "select",
    options: ["Roof repair", "New roof", "Flat roofing", "Slate or tile roof"],
  },
  {
    id: "property",
    label: "Property type",
    type: "select",
    options: ["House", "Flat", "Commercial property", "Other"],
  },
  {
    id: "urgency",
    label: "How urgent is the work?",
    type: "select",
    options: ["Urgent", "This month", "Planning ahead"],
  },
  {
    id: "postcode",
    label: "Property postcode",
    type: "postcode",
    placeholder: "ME4…",
  },
  {
    id: "photo",
    label: "Add a roof photo (demo only)",
    type: "file",
    accept: "image/*",
  },
] as const;

const proofPoints: readonly ProofPoint[] = [
  {
    body: "New roofs, repairs, flat roofing, lead work, slate roofing, chimneys, guttering, fascias and soffits.",
    icon: Home,
    title: "Full roofing system",
  },
  {
    body: "Free visits and written quotations make the scope clear before work starts.",
    icon: ClipboardCheck,
    title: "Transparent quoting",
  },
  {
    body: "Fully insured work, independent approvals and an insurance-backed guarantee support the trust story.",
    icon: ShieldCheck,
    title: "Proof customers can check",
  },
];

export function PrimelineRoofingPage() {
  return (
    <div
      className="primelinePage min-h-screen"
      data-bespoke-prospect="primeline-roofing"
    >
      <ConceptBar businessName="Primeline Roofing" />
      <main>
        <PrimelineRoofingHero />
        <RevealOnScroll
          as="section"
          className="px-5 py-20 text-[#071126] sm:px-8"
          id="services"
        >
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase text-[#1753a3]">
              Roofing & Building Ltd
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[.78fr_1fr] lg:items-end">
              <h2 className="max-w-3xl text-4xl font-black leading-[.94] tracking-normal sm:text-6xl">
                Premium service, made easier to choose.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                The demo turns Primeline proof into a clearer first action:
                pick the roofing need, share the property context and give the
                team enough detail to prepare a focused visit.
              </p>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-3">
              {proofPoints.map((point) => (
                <article className="bg-white p-6 sm:p-8" key={point.title}>
                  <point.icon
                    aria-hidden="true"
                    className="size-6 text-[#1753a3]"
                  />
                  <h3 className="mt-8 text-xl font-black tracking-tight">
                    {point.title}
                  </h3>
                  <p className="mt-4 leading-7 text-slate-600">{point.body}</p>
                </article>
              ))}
            </div>
          </div>
        </RevealOnScroll>
        <RevealOnScroll
          as="section"
          className="bg-[#071126] px-5 py-18 text-white sm:px-8"
          id="proof"
        >
          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
            {[
              ["20+", "years of experience"],
              ["4.97", "TrustATrader rating"],
              ["5.0", "Google rating"],
              ["Free", "site visit and quote"],
            ].map(([value, label]) => (
              <article
                className="rounded-lg border border-white/12 bg-white/[.06] p-6"
                key={label}
              >
                <p className="text-4xl font-black text-white">{value}</p>
                <h3 className="mt-4 text-sm font-bold uppercase text-white/62">
                  {label}
                </h3>
              </article>
            ))}
          </div>
        </RevealOnScroll>
        <section
          className="bg-[#f4f7fb] px-5 py-24 text-[#071126] sm:px-8"
          id="visit"
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase text-[#1753a3]">
                Free quote route
              </p>
              <h2 className="mt-5 text-5xl font-black tracking-normal">
                Make the first visit more useful.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                A live version could send Primeline the service, property,
                timing and photo context before a site visit is arranged.
              </p>
              <a
                className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#1753a3] px-5 py-3 text-sm font-black text-white shadow-[0_18px_44px_-22px_#1753a3] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1753a3]"
                href="#visit"
              >
                <Camera aria-hidden="true" className="size-4" />
                Prepare the roof brief
              </a>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Primeline Roofing"
                buttonLabel="Prepare site-visit request"
                fields={fields}
                formClassName="rounded-lg bg-white p-6 shadow-xl sm:p-9"
                successTitle="Your site-visit brief is ready"
                successMessage="A live version could send Primeline the work, building, urgency and photo context before the free site visit."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Primeline Roofing" />
    </div>
  );
}
