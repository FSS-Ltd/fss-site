import Image from "next/image";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarClock,
  FileCheck2,
  Landmark,
  UsersRound,
} from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";

const assetBase = "/prospect-previews/bespoke/priority-point";

const enquiryFields = [
  {
    id: "service",
    label: "Choose the responsibility",
    type: "select",
    options: [
      "Company registration",
      "Bookkeeping",
      "Payroll",
      "VAT",
      "Annual accounts",
      "Corporation tax",
      "CIS",
    ],
  },
  {
    id: "structure",
    label: "Business structure",
    type: "select",
    options: [
      "Limited company",
      "Self employed",
      "Contractor",
      "Not set up yet",
    ],
  },
  {
    id: "timing",
    label: "Next deadline",
    type: "select",
    options: [
      "Within 30 days",
      "Within three months",
      "Later this year",
      "Not sure",
    ],
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

const serviceRoutes = [
  {
    Icon: Landmark,
    title: "Company foundations",
    body: "Company registration and accounts begin with the structure, the stage of the business and the dates that matter.",
    services: "Company registration · Annual accounts",
  },
  {
    Icon: BookOpenCheck,
    title: "Books and tax",
    body: "Bookkeeping, VAT and corporation-tax conversations are more useful when the responsibility is clear from the first message.",
    services: "Bookkeeping · VAT · Corporation tax",
  },
  {
    Icon: UsersRound,
    title: "People and projects",
    body: "Payroll and construction-industry support can start with the people, work and reporting pressures already in view.",
    services: "Payroll · CIS",
  },
] as const;

const preparationSteps = [
  {
    Icon: BriefcaseBusiness,
    number: "01",
    title: "Name the responsibility",
    body: "Choose the service that needs attention instead of starting with a blank contact form.",
  },
  {
    Icon: FileCheck2,
    number: "02",
    title: "Give the business context",
    body: "Share the business structure so the first conversation begins from the right place.",
  },
  {
    Icon: CalendarClock,
    number: "03",
    title: "Flag the deadline",
    body: "Make timing visible before the practice replies, whether the need is urgent or planned ahead.",
  },
] as const;

export function PriorityPointPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f8f7f2] text-[#243b6b]"
      data-bespoke-prospect="priority-point"
    >
      <ConceptBar businessName="Priority Point" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-6 sm:px-8 lg:px-10">
          <a className="shrink-0" href="#top">
            <Image
              alt="Priority Point licensed practice"
              className="h-auto w-44 object-contain sm:w-52"
              height={70}
              src={`${assetBase}/logo.png`}
              width={242}
            />
          </a>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#243b6b] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#243b6b] sm:px-5"
            href="#enquiry"
          >
            Start a conversation
          </a>
        </header>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-5 sm:px-8 lg:grid-cols-[minmax(0,.92fr)_minmax(30rem,1.08fr)] lg:items-center lg:px-10 lg:pb-28">
          <div className="max-w-2xl" id="top">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7f9c38]">
              Licensed accountancy practice
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[0.93] tracking-[-0.065em] text-[#243b6b] sm:text-7xl lg:text-[5.8rem]">
              Put the next business responsibility in focus.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#243b6b]/70 sm:text-xl">
              Company registration, bookkeeping, payroll, VAT, accounts, tax and
              construction-industry support. Start with what needs attention,
              the business structure and the next deadline.
            </p>
            <a
              className="mt-9 inline-flex min-h-11 items-center gap-3 border-b-2 border-[#a7c05a] pb-2 text-sm font-bold transition hover:border-[#243b6b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#243b6b]"
              href="#enquiry"
            >
              Prepare the first conversation
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </div>

          <div className="relative min-h-[26rem] overflow-hidden rounded-[2rem_5rem_2rem_5rem] bg-[#243b6b] shadow-[0_35px_90px_-45px_rgba(36,59,107,.85)] sm:min-h-[33rem]">
            <Image
              alt="Business records organised for payroll, VAT and annual accounts."
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              src={`${assetBase}/hero-v1.png`}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(130deg,rgba(36,59,107,.14),rgba(36,59,107,0)_50%,rgba(36,59,107,.24))]"
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/25 bg-[#243b6b]/92 p-4 text-white shadow-xl backdrop-blur sm:bottom-7 sm:left-7 sm:right-auto sm:max-w-72 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c8dd78]">
                A clear first brief
              </p>
              <p className="mt-2 text-lg font-semibold leading-6 tracking-[-0.03em]">
                Responsibility, structure, deadline.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-[#243b6b]/10 bg-white px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7f9c38]">
                  Start with the work
                </p>
                <h2 className="mt-5 max-w-lg text-4xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl">
                  The right route can be obvious before the first call.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-[#243b6b]/70">
                Priority Point already separates its accountancy services. This
                concept gives each visitor a simple place to start, so a query
                about a company, recurring records, payroll or tax does not
                begin as a generic message.
              </p>
            </div>

            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {serviceRoutes.map(({ Icon, body, services, title }) => (
                <article
                  className="flex min-h-72 flex-col rounded-[1.75rem] border border-[#243b6b]/10 bg-[#f8f7f2] p-6 shadow-[0_24px_70px_-55px_rgba(36,59,107,.55)]"
                  key={title}
                >
                  <Icon aria-hidden="true" className="size-7 text-[#7f9c38]" />
                  <h3 className="mt-16 text-2xl font-semibold tracking-[-0.045em]">
                    {title}
                  </h3>
                  <p className="mt-3 leading-7 text-[#243b6b]/68">{body}</p>
                  <p className="mt-auto pt-6 text-sm font-bold text-[#243b6b]">
                    {services}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#243b6b] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.88fr_1.12fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c8dd78]">
                A prepared conversation
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl">
                Better context, before the practice has to ask for it.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">
                The contact route can gather just enough information to make the
                next reply relevant. It stays human, but the starting point is
                less ambiguous for everyone.
              </p>
            </div>

            <ol className="grid gap-4 sm:grid-cols-3">
              {preparationSteps.map(({ Icon, body, number, title }) => (
                <li
                  className="rounded-[1.5rem] border border-white/15 bg-white/8 p-5 shadow-[0_24px_64px_-46px_rgba(0,0,0,.75)]"
                  key={number}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm font-bold text-[#c8dd78]">
                      {number}
                    </span>
                    <Icon aria-hidden="true" className="size-5 text-white/75" />
                  </div>
                  <h3 className="mt-12 text-xl font-semibold tracking-[-0.035em]">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/67">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="grid bg-[#edf0e3] lg:grid-cols-2" id="enquiry">
          <div className="relative min-h-[28rem] overflow-hidden bg-[#243b6b] sm:min-h-[36rem]">
            <Image
              alt="An organised accountancy conversation brief with folders and a note ready for review."
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              src={`${assetBase}/brief-board-v1.webp`}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(0deg,rgba(36,59,107,.48),rgba(36,59,107,0)_48%)]"
            />
            <div className="absolute bottom-6 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-8">
              <p className="max-w-sm text-2xl font-semibold leading-8 tracking-[-0.04em] text-white">
                A short brief gives the first response somewhere useful to
                begin.
              </p>
            </div>
          </div>

          <div className="px-5 py-20 sm:px-8 sm:py-28 lg:px-14">
            <div className="mx-auto max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7f9c38]">
                One ordered route
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-5xl">
                Start with the responsibility, then the deadline.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#243b6b]/70">
                This demonstration prepares context for a focused reply. It does
                not submit or store information.
              </p>
              <DemoEnquiry
                businessName="Priority Point"
                buttonLabel="Prepare my accountancy enquiry"
                fields={enquiryFields}
                formClassName="mt-10 rounded-[1.75rem] border border-[#243b6b]/10 bg-white p-5 shadow-[0_30px_80px_-55px_rgba(36,59,107,.65)] sm:p-7"
                successMessage="A live version could route the service, business structure and deadline to the right Priority Point accountant."
                successTitle="Your accountancy brief is ready"
              />
            </div>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Priority Point" />
    </div>
  );
}
