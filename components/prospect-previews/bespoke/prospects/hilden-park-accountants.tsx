import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import {
  InteractiveJourney,
  type JourneyStep,
} from "../interactive-journey";

const fields = [
  {
    id: "client",
    label: "Who needs support?",
    type: "select",
    options: ["Business", "Individual", "Trust or estate", "Existing client"],
  },
  {
    id: "service",
    label: "Accountancy need",
    type: "select",
    options: [
      "Business accounts",
      "Taxation",
      "Support services",
      "Individual tax",
      "Not sure",
    ],
  },
  { id: "deadline", label: "Next deadline or decision", type: "date" },
  {
    id: "office",
    label: "Preferred office",
    type: "select",
    options: ["Hildenborough", "Sevenoaks", "Remote conversation"],
  },
] as const;

const journeySteps: readonly JourneyStep[] = [
  {
    description: "Start with the person, business, trust or estate that needs support.",
    icon: "user",
    id: "client",
    nextStep: "The practice can frame the first response around the right client context.",
    number: "01",
    title: "Person or business",
  },
  {
    description: "Accounts, taxation and wider support each need a different opening conversation.",
    icon: "briefcase",
    id: "service",
    nextStep: "The enquiry can reach the relevant service route before a meeting is proposed.",
    number: "02",
    title: "Service context",
  },
  {
    description: "A filing date or decision date gives the team a useful sense of timing.",
    icon: "calendar",
    id: "deadline",
    nextStep: "The response can account for the date that matters rather than discover it later.",
    number: "03",
    title: "Next deadline",
  },
  {
    description: "Documents should follow a relevant first response, not replace one.",
    icon: "lock",
    id: "follow-up",
    nextStep: "A secure follow-up can request only the records needed for the next step.",
    number: "04",
    title: "Secure follow-up",
  },
];

export function HildenParkAccountantsPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f7f8f8] text-[#17375f]"
      data-bespoke-prospect="hilden-park-accountants"
    >
      <ConceptBar businessName="Hilden Park Chartered Accountants" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
          <Image
            alt="Hilden Park Chartered Accountants"
            className="h-auto w-64"
            height={272}
            src="/prospect-previews/bespoke/hilden-park-accountants/logo.png"
            width={1848}
          />
          <a
            className="rounded-full bg-[#0050a4] px-5 py-3 text-sm font-bold text-white"
            href="#accountancy-route"
          >
            Prepare a conversation
          </a>
        </header>
        <section className="mx-auto grid max-w-[96rem] bg-white lg:grid-cols-[.92fr_1.08fr]">
          <div className="flex items-end p-7 sm:p-12 lg:p-16">
            <div data-prospect-hero-copy="true">
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#6d7f91]">
                Hildenborough · Sevenoaks
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[.92] tracking-[-.065em] sm:text-7xl">
                The right accountancy conversation starts before the first
                meeting.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#17375f]/65">
                Business, individual and existing-client needs, prepared around
                the service and next deadline.
              </p>
              <a
                className="mt-10 inline-flex items-center gap-3 border-b-2 border-[#0050a4] pb-2 font-bold"
                href="#accountancy-route"
              >
                Choose the route <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
          <div className="relative min-h-[66svh]">
            <Image
              alt="A calm accountancy meeting table prepared for a client conversation"
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              src="/prospect-previews/bespoke/hilden-park-accountants/hero-v1.png"
            />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#17375f]/35 to-transparent" />
          </div>
        </section>

        <section className="bg-[#17375f] px-5 py-20 text-white sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <InteractiveJourney
              ariaLabel="Accountancy first-response journey"
              description="Select a step to see what context changes before an initial accountancy conversation."
              eyebrow="A prepared first response"
              heading="Four pieces of context, in the right order."
              steps={journeySteps}
            />
          </div>
        </section>

        <section
          className="grid bg-[#e5e9ec] lg:grid-cols-[.68fr_1.32fr]"
          id="accountancy-route"
        >
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#0050a4]">
              Client intake
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
              Start with relevance, then request documents.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-[#17375f]/62">
              This review concept keeps the interaction human while giving the
              practice a clearer first brief.
            </p>
          </div>
          <div className="p-5 sm:p-10 lg:p-16">
            <DemoEnquiry
              businessName="Hilden Park Chartered Accountants"
              buttonLabel="Prepare accountancy conversation"
              fields={fields}
              formClassName="rounded-[1.5rem] bg-white p-6 shadow-[0_35px_100px_-65px_rgba(23,55,95,.8)] sm:p-9"
              successTitle="Accountancy route prepared"
              successMessage="A live version could send the client type, service, deadline and office preference as one relevant first enquiry."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Hilden Park Chartered Accountants" />
    </div>
  );
}
