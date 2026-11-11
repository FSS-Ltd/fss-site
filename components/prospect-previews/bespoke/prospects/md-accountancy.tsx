import Image from "next/image";
import { ArrowDownRight } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { MdFinanceWorkspace } from "./md-finance-workspace";

const fields = [
  {
    id: "stage",
    label: "Business stage",
    type: "select",
    options: ["Starting", "Established", "Growing", "Changing finance support"],
  },
  {
    id: "support",
    label: "Finance support",
    type: "select",
    options: [
      "Bookkeeping and reporting",
      "Tax and compliance",
      "Finance team support",
      "Growth planning",
      "Not sure yet",
    ],
  },
  { id: "deadline", label: "Next deadline", type: "date" },
  {
    id: "context",
    label: "What should the team know?",
    type: "textarea",
    placeholder: "Current position, question or decision",
  },
] as const;

const workflow = [
  {
    detail: "See the business stage, the immediate decision and the date that matters.",
    number: "01",
    title: "Start with position",
  },
  {
    detail: "Turn that context into a focused call, not a request for every document.",
    number: "02",
    title: "Shape the question",
  },
  {
    detail: "Request the right records only after the team has agreed the next useful step.",
    number: "03",
    title: "Move with clarity",
  },
] as const;

export function MdAccountancyPage() {
  return (
    <div
      className="min-h-screen bg-[#f7f5f1] text-[#171717]"
      data-bespoke-prospect="md-accountancy"
    >
      <ConceptBar businessName="MD Accountancy Team" />
      <main>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Image
            alt="MD Accountancy Team Limited"
            className="h-auto w-56 rounded-sm bg-[#171717] px-3 py-2"
            height={66}
            src="/prospect-previews/bespoke/md-accountancy/logo.png"
            width={260}
          />
          <a
            className="inline-flex items-center gap-2 text-sm font-black text-[#d91f2a] transition-colors hover:text-[#171717] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f2a]"
            href="#finance-route"
          >
            Prepare the call <ArrowDownRight className="size-4" />
          </a>
        </header>
        <section
          className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-5 sm:px-8 sm:pb-28 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-16 lg:pt-12"
          data-md-conversation-hero="true"
        >
          <div className="py-8 lg:py-16">
            <div data-prospect-hero-copy="true">
              <p className="inline-flex rounded-full border border-black/12 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-[#d91f2a]">
                Marden · Business finance
              </p>
              <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-[.9] tracking-[-.065em] sm:text-7xl">
                Accountancy should begin with your question, not a list of documents.
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-8 text-black/62">
                Bring the decision in front of you. The first conversation can
                start with the business you are building, the pressure you are
                carrying and the support that would make a difference.
              </p>
              <a
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#171717] px-5 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5 hover:bg-[#d91f2a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d91f2a]"
                href="#finance-route"
              >
                Prepare a first conversation <ArrowDownRight className="size-4" />
              </a>
              <p className="mt-8 max-w-md border-l-2 border-[#d91f2a] pl-4 text-sm font-semibold leading-6 text-black/58">
                A more useful first meeting starts with what matters to the person
                running the business.
              </p>
            </div>
          </div>
          <div
            className="relative min-h-[30rem] overflow-hidden rounded-[2rem] bg-[#171717] shadow-[0_35px_90px_-54px_rgb(23_23_23_/_0.7)] sm:min-h-[38rem]"
            data-md-conversation-image="true"
          >
            <Image
              alt="Two people preparing for a thoughtful accountancy conversation"
              className="object-cover object-[62%_center]"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src="/prospect-previews/bespoke/md-accountancy/hero-v1.png"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/72 via-black/22 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/18 bg-white/92 p-5 text-[#171717] shadow-lg sm:bottom-7 sm:left-7 sm:right-auto sm:max-w-xs">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#d91f2a]">
                A better first meeting
              </p>
              <p className="mt-2 text-lg font-semibold leading-6 tracking-[-.03em]">
                Start with the decision. Build the right support around it.
              </p>
            </div>
          </div>
        </section>
        <section className="px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-7xl">
            <MdFinanceWorkspace />
          </div>
        </section>
        <section
          className="border-t border-black/10 px-5 py-16 sm:px-8 sm:py-24"
          data-md-finance-workflow="true"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#d91f2a]">
                One useful sequence
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                Better finance support begins with a better view of the work.
              </h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {workflow.map((step, index) => (
                <RevealOnScroll
                  className="h-full"
                  delay={index * 120}
                  key={step.number}
                >
                  <article className="flex h-full min-h-64 flex-col justify-between rounded-[2rem] border border-black/10 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_24px_55px_-42px_rgb(23_23_23_/_0.65)] sm:p-8">
                    <span className="font-mono text-sm text-[#d91f2a]">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-[-.04em]">
                        {step.title}
                      </h3>
                      <p className="mt-4 leading-7 text-black/58">
                        {step.detail}
                      </p>
                    </div>
                  </article>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>
        <section className="border-y border-black/10 px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#d91f2a]">
                Fit before files
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                Move from a vague enquiry to a considered financial brief.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-black/62">
                The workspace makes a simple point: every business should be
                able to see what the first conversation is for before records
                are requested.
              </p>
            </div>
            <div
              className="relative min-h-80 overflow-hidden rounded-[2rem] border border-black/10"
              data-md-supporting-image="true"
            >
              <Image
                alt="An accountancy adviser speaking with a small-business owner in a bright office"
                className="object-cover"
                fill
                sizes="(min-width: 1024px) 46vw, 100vw"
                src="/prospect-previews/bespoke/md-accountancy/supporting-conversation-v1.png"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171717]/78 via-[#171717]/5 to-transparent" />
              <p className="absolute bottom-6 left-6 right-6 max-w-sm text-sm font-semibold leading-6 text-white/82">
                A better first brief gives the team a more useful first meeting.
              </p>
            </div>
          </div>
        </section>
        <section className="bg-[#d91f2a] px-5 py-20 sm:px-8" id="finance-route">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-black/55">
                Discovery route
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">
                Start with relevance. Ask for records second.
              </h2>
            </div>
            <DemoEnquiry
              businessName="MD Accountancy Team"
              buttonLabel="Prepare discovery call"
              fields={fields}
              formClassName="rounded-none bg-white p-6 text-slate-950 shadow-[16px_16px_0_#0c0c0d] sm:p-9"
              successTitle="Finance route prepared"
              successMessage="A live version could send the stage, support need, deadline and context as one prepared discovery brief."
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="MD Accountancy Team" />
    </div>
  );
}
