import Image from "next/image";
import {
  ArrowDown,
  BadgePoundSterling,
  CheckCircle2,
  FileText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ConceptBar } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const heroImage =
  "/prospect-previews/bespoke/bright-accounting/hero-ledger-v1.webp";
const clientDeskImage =
  "/prospect-previews/bespoke/bright-accounting/client-desk-v1.webp";
const deadlineObjectImage =
  "/prospect-previews/bespoke/bright-accounting/deadline-object-v1.webp";

const serviceFields = [
  {
    id: "service",
    label: "What would you like help with?",
    type: "select",
    options: [
      "Bookkeeping & VAT",
      "Personal Tax",
      "Sole Trader",
      "Limited Company",
      "Company Secretarial",
      "Business advisory service",
    ],
  },
  {
    id: "client-type",
    label: "Who is the support for?",
    type: "select",
    options: [
      "Self-employed",
      "Partnership",
      "Limited company",
      "Individual tax return",
      "New business",
    ],
  },
  {
    id: "timing",
    label: "When do you need advice?",
    type: "select",
    options: [
      "Before a filing deadline",
      "This month",
      "Before starting a business",
      "Planning ahead",
    ],
  },
  {
    id: "location",
    label: "Where are you based?",
    type: "postcode",
    placeholder: "TN9...",
  },
] as const;

const serviceCards = [
  {
    title: "Bookkeeping & VAT",
    body: "Capture record-keeping, VAT timing and software support before the first call.",
    Icon: ReceiptText,
  },
  {
    title: "Personal Tax",
    body: "Separate tax returns, rental income, CIS refunds and PAYE questions from general messages.",
    Icon: FileText,
  },
  {
    title: "Sole Trader",
    body: "Route tax, CIS, HMRC correspondence and payment reminders into one organised brief.",
    Icon: BadgePoundSterling,
  },
  {
    title: "Limited Company",
    body: "Collect company stage, accounts, Companies House and advisory needs in a structured flow.",
    Icon: ShieldCheck,
  },
] as const;

const proofPoints = [
  "Upfront fixed-fee positioning",
  "Free consultation route",
  "Tonbridge, Tunbridge Wells and Sevenoaks coverage",
  "Accounting and auditing activities, company 09356208",
] as const;

const journeySteps = [
  "Choose the service",
  "Give client type and location",
  "Flag deadline pressure",
  "Receive a prepared consultation",
] as const;

export function BrightAccountingPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f5f2ea] text-[#101418]"
      data-bespoke-prospect="bright-accounting"
    >
      <ConceptBar businessName="Bright Accounting Ltd" />
      <main>
        <section className="relative isolate min-h-screen overflow-hidden bg-[#101418] text-white">
          <Image
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover object-center opacity-82"
            fill
            priority
            sizes="100vw"
            src={heroImage}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,20,24,.94)_0%,rgba(16,20,24,.74)_38%,rgba(16,20,24,.22)_76%),linear-gradient(0deg,rgba(16,20,24,.76)_0%,rgba(16,20,24,0)_52%)]"
          />

          <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
            <a
              className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-2xl shadow-black/20 backdrop-blur-2xl"
              href="#top"
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#e9c46a] text-xs font-black text-[#102b2b]">
                B
              </span>
              Bright Accounting
            </a>
            <a
              className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/82 backdrop-blur-2xl transition hover:text-white sm:inline-flex"
              href="#service-route"
            >
              Build a better first enquiry
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </header>

          <div className="mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-7xl items-end gap-12 px-5 pb-14 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,.78fr)] lg:pb-20">
            <RevealOnScroll className="max-w-4xl">
              <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/78 backdrop-blur-2xl">
                Tonbridge accountancy | Private concept
              </p>
              <h1 className="mt-7 max-w-[11ch] text-5xl font-semibold leading-[0.9] tracking-[-0.06em] sm:text-7xl lg:text-[6.7rem]">
                Make the first tax question feel clear.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72 sm:text-xl">
                Bright already explains bookkeeping, VAT, tax, sole trader,
                limited company and advisory support. This concept turns that
                breadth into a calm guided route before the first consultation.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#101418] shadow-[0_24px_70px_-30px_rgba(255,255,255,.65)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  href="#service-route"
                >
                  Start the service route
                  <ArrowDown aria-hidden="true" className="size-4" />
                </a>
                <a
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white/82 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  href="#certificate"
                >
                  View trust gap
                </a>
              </div>
            </RevealOnScroll>

            <RevealOnScroll
              className="relative mx-auto min-h-[30rem] w-full max-w-[30rem]"
              delay={120}
            >
              <div className="absolute inset-x-[9%] bottom-[12%] top-[4%] rounded-[2.5rem] border border-white/20 bg-white/12 shadow-[0_40px_100px_-36px_rgba(0,0,0,.72)] backdrop-blur-3xl [transform:rotateY(-10deg)_rotateX(6deg)]" />
              <Image
                alt=""
                className="absolute inset-x-[-8%] bottom-[3%] z-10 h-auto w-[115%] drop-shadow-[0_40px_60px_rgba(0,0,0,.45)]"
                height={1000}
                priority
                src={deadlineObjectImage}
                width={1000}
              />
              <div className="absolute right-[3%] top-[10%] z-20 rounded-2xl border border-white/20 bg-[#f7f4ec]/90 p-4 text-[#101418] shadow-2xl backdrop-blur-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#62706b]">
                  Consultation brief
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  Need | Type | Deadline
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        <section className="bg-[#f7f4ec] px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-end">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a7973]">
                Evidence-backed angle
              </p>
              <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl">
                Bright has the services. The website can do more of the first
                conversation.
              </h2>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <p className="text-lg leading-8 text-[#58615f]">
                Their public pages list fixed fees, free consultation, personal
                service, business advisory support and multiple accountancy
                routes. The current repeated enquiry form asks visitors to
                explain everything in one message. A guided route gives Bright a
                cleaner brief and helps clients feel they have chosen the right
                starting point.
              </p>
            </RevealOnScroll>
          </div>

          <div className="mx-auto mt-14 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
            {serviceCards.map(({ Icon, body, title }) => (
              <RevealOnScroll key={title}>
                <article className="h-full rounded-[1.75rem] border border-[#ddd6ca] bg-white/76 p-6 shadow-[0_24px_70px_-54px_rgba(16,20,24,.45)] backdrop-blur">
                  <Icon aria-hidden="true" className="size-6 text-[#0a7973]" />
                  <h3 className="mt-14 text-2xl font-semibold tracking-[-0.04em]">
                    {title}
                  </h3>
                  <p className="mt-3 leading-7 text-[#65706d]">{body}</p>
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </section>

        <section
          className="grid bg-[#101418] text-white lg:grid-cols-[1.05fr_.95fr]"
          id="certificate"
        >
          <RevealOnScroll className="relative min-h-[34rem] overflow-hidden">
            <Image
              alt="A premium desk scene showing an accountant preparing structured service advice."
              className="size-full object-cover"
              fill
              sizes="(min-width: 1024px) 52vw, 100vw"
              src={clientDeskImage}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,20,24,.12),rgba(16,20,24,.52)),linear-gradient(0deg,rgba(16,20,24,.64),rgba(16,20,24,0)_50%)]"
            />
          </RevealOnScroll>
          <RevealOnScroll className="px-5 py-16 sm:px-8 sm:py-24 lg:px-14">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e9c46a]">
                Trust detail
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
                Website confidence should match financial confidence.
              </h2>
              <p className="mt-6 text-lg leading-8 text-white/70">
                I noticed the security certificate on the site expired on 21
                October 2021. For an accountancy practice handling sensitive
                conversations, that detail can weaken trust before a prospect
                reaches the form.
              </p>
              <div className="mt-8 rounded-[1.75rem] border border-white/15 bg-white/10 p-6 backdrop-blur-2xl">
                <div className="flex items-start gap-4">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-1 size-6 shrink-0 text-[#8ee3d8]"
                  />
                  <p className="leading-7 text-white/78">
                    A dedicated website team would keep the certificate,
                    privacy route, enquiry flow and performance looked after
                    while Bright focuses on serving customers.
                  </p>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </section>

        <section className="bg-[#ede7dc] px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a7973]">
                Apple-level interaction model
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
                A client chooses the shape of the work before asking for help.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[#58615f]">
                The experience stays simple, but the intake is structured
                enough to route a tax return differently from a limited company,
                VAT or advisory conversation.
              </p>
            </RevealOnScroll>

            <div className="grid gap-4 sm:grid-cols-2">
              {journeySteps.map((step, index) => (
                <RevealOnScroll delay={index * 70} key={step}>
                  <article className="min-h-44 rounded-[1.75rem] border border-white/70 bg-white/58 p-6 shadow-[0_24px_70px_-56px_rgba(16,20,24,.55)] backdrop-blur-2xl">
                    <p className="font-mono text-sm text-[#0a7973]">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-10 text-2xl font-semibold tracking-[-0.04em]">
                      {step}
                    </h3>
                  </article>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f4ec] px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.78fr_1.22fr]">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a7973]">
                Proof to preserve
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
                Keep Bright&apos;s useful signals visible.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-[#58615f]">
                The point is not to replace the personal accountant. It is to
                protect that personal service with a better first handoff.
              </p>
            </RevealOnScroll>
            <div className="grid gap-4 sm:grid-cols-2">
              {proofPoints.map((point) => (
                <RevealOnScroll key={point}>
                  <article className="flex min-h-28 items-start gap-4 rounded-[1.5rem] border border-[#ddd6ca] bg-white/78 p-5 shadow-sm">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-1 size-5 shrink-0 text-[#0a7973]"
                    />
                    <p className="font-semibold leading-7">{point}</p>
                  </article>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section
          className="bg-[#101418] px-5 py-20 text-white sm:px-8 sm:py-28"
          id="service-route"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e9c46a]">
                Demonstration route
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
                Start with the service need, not a blank message box.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/68">
                A live version could create the right email notification,
                dashboard item or follow-up workflow for Bright. This demo is
                not currently connected to Bright&apos;s live systems.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={90}>
              <div className="rounded-[2rem] border border-white/14 bg-white/10 p-2 shadow-[0_40px_110px_-56px_rgba(0,0,0,.82)] backdrop-blur-2xl">
                <DemoEnquiry
                  businessName="Bright Accounting Ltd"
                  buttonLabel="Prepare accountancy brief"
                  fields={serviceFields}
                  formClassName="rounded-[1.6rem] bg-[#fbf8f0] p-6 text-[#101418] sm:p-8"
                  successTitle="The accountancy brief is ready"
                  successMessage="A live version could route the service, client type, deadline and location to Bright before the first consultation."
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </main>

      <aside className="bg-[#f7f4ec] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#ddd6ca] bg-white/76 p-7 shadow-[0_28px_90px_-60px_rgba(16,20,24,.6)] backdrop-blur sm:p-10">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0a7973]">
                <Sparkles aria-hidden="true" className="size-4" />
                A private concept for Bright Accounting Ltd
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
                A trusted accountancy practice deserves a website that carries
                the same care.
              </h2>
            </div>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#101418] px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#101418]"
              href="mailto:hello@faithfulsoftware.dev"
            >
              Discuss this concept
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
