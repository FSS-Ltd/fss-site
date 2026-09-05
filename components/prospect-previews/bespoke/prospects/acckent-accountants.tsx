import Image from "next/image";
import {
  BookOpenCheck,
  CalendarRange,
  FileSpreadsheet,
  Layers3,
} from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";

const fields = [
  {
    id: "support",
    label: "Support type",
    type: "select",
    options: [
      "Monthly accounting",
      "One-off year-end accounts",
      "FreeAgent support",
      "Company tax",
      "Not sure yet",
    ],
  },
  { id: "year-end", label: "Company year end", type: "date" },
  {
    id: "records",
    label: "Current records",
    type: "select",
    options: [
      "FreeAgent",
      "Another platform",
      "Spreadsheets",
      "Records need organising",
    ],
  },
  {
    id: "deadline",
    label: "Next deadline or question",
    type: "textarea",
    placeholder: "What is coming up?",
  },
] as const;

const route = [
  [
    Layers3,
    "Choose the support",
    "Monthly or one-off work takes a different route.",
  ],
  [
    CalendarRange,
    "Add the year end",
    "Put the next deadline in view before the reply.",
  ],
  [
    FileSpreadsheet,
    "Place the records",
    "FreeAgent, another platform or records to organise.",
  ],
  [
    BookOpenCheck,
    "Review the brief",
    "Send one useful accountancy starting point.",
  ],
] as const;

export function AcckentAccountantsPage() {
  return (
    <div
      className="min-h-screen bg-[#f4f6f8] text-[#0b3158]"
      data-bespoke-prospect="acckent-accountants"
    >
      <ConceptBar businessName="AccKent Accountants" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Image
            alt="AccKent Accountants"
            className="h-auto w-64"
            height={221}
            src="/prospect-previews/bespoke/acckent-accountants/logo.jpg"
            width={771}
          />
          <a
            className="border-l-4 border-[#a71918] pl-4 text-sm font-black"
            href="#accounts-route"
          >
            Start with the company need
          </a>
        </header>
        <section className="relative min-h-[72svh] overflow-hidden bg-[#0b3158] text-white">
          <Image
            alt="A limited-company accounting handover prepared in a Dartford office"
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src="/prospect-previews/bespoke/acckent-accountants/hero-v1.png"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b3158] via-[#0b3158]/78 to-transparent" />
          <div className="relative mx-auto flex min-h-[72svh] max-w-7xl items-center px-5 py-16 sm:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#f0a3a2]">
                Dartford · Limited companies
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[.9] tracking-[-.06em] sm:text-7xl">
                Start limited-company accountancy with the deadline and records
                already organised.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/68">
                Choose monthly or one-off support, add the year end and prepare
                the bookkeeping context before speaking with AccKent.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-0 overflow-hidden rounded-[2rem] border border-[#0b3158]/12 md:grid-cols-2 lg:grid-cols-4">
            {route.map(([Icon, title, body], index) => (
              <article
                className="border-b border-r border-[#0b3158]/12 bg-white p-7"
                key={title}
              >
                <span className="font-mono text-xs text-[#a71918]">
                  0{index + 1}
                </span>
                <Icon className="mt-12 size-7" />
                <h2 className="mt-6 text-xl font-black">{title}</h2>
                <p className="mt-3 leading-7 text-[#0b3158]/60">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="bg-[#a71918] px-5 py-20 text-white sm:px-8"
          id="accounts-route"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-white/62">
                Accountancy intake
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                Monthly support and year-end work, separated early.
              </h2>
            </div>
            <DemoEnquiry
              businessName="AccKent Accountants"
              buttonLabel="Prepare accountancy request"
              fields={fields}
              formClassName="rounded-[1.25rem] bg-white p-6 text-[#0b3158] shadow-xl sm:p-9"
              successTitle="Accountancy request prepared"
              successMessage="A live version could send the support type, year end, records position and deadline as one useful brief."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="AccKent Accountants" />
    </div>
  );
}
