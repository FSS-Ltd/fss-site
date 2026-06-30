import {
  ArrowRight,
  BrainCircuit,
  FileLock2,
  Gauge,
  Network,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AiDeploymentQuiz } from "@/components/sections/ai-questionnaire/ai-deployment-quiz";
import { ButtonLink } from "@/components/ui/button";

type Insight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type Faq = {
  question: string;
  answer: string;
};

const insights: Insight[] = [
  {
    icon: FileLock2,
    title: "Sensitive data changes the answer",
    description:
      "Client files, patient records, contracts, finance data, and privileged material often need private processing and clear audit boundaries.",
  },
  {
    icon: Gauge,
    title: "Speed still matters",
    description:
      "Cloud AI can be the right first step for approved, low-risk workflows where speed, breadth, and cost matter more than private hosting.",
  },
  {
    icon: Network,
    title: "Most firms need a split",
    description:
      "Hybrid AI keeps confidential workflows local or private while using approved cloud tools for routine productivity gains.",
  },
];

const sectors = [
  "Law firms",
  "Clinics",
  "Hospitals",
  "Finance teams",
  "Charities",
  "Service businesses",
];

export const aiQuestionnaireFaqs: Faq[] = [
  {
    question: "Is local AI better than cloud AI for business?",
    answer:
      "Local AI is better when the AI needs to process sensitive, regulated, or confidential data. Cloud AI is often better for low-risk workflows that need speed, broad model capability, and lower infrastructure cost.",
  },
  {
    question: "When should a business use private AI?",
    answer:
      "A business should consider private AI when workflows involve client records, patient information, financial data, legal privilege, confidential contracts, or data residency requirements.",
  },
  {
    question: "What is hybrid AI?",
    answer:
      "Hybrid AI uses more than one deployment pattern. Sensitive workflows run locally or in a private environment, while lower-risk productivity tasks use approved cloud AI tools.",
  },
  {
    question: "Can AI reduce admin work without exposing data to public APIs?",
    answer:
      "Yes. A local or private AI workflow can summarise, classify, draft, search, and route internal information without sending sensitive data to unmanaged public AI APIs.",
  },
];

const processSteps = [
  "Map the workflows where admin work is slowing revenue or service delivery.",
  "Separate confidential data flows from low-risk productivity tasks.",
  "Choose local, cloud, or hybrid AI based on risk, cost, speed, and control.",
  "Build a small pilot with human review, logging, and clear staff guidance.",
];

export function AiQuestionnairePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#f2f3f5] px-7 pb-20 pt-[138px]">
        <canvas
          data-hero-canvas
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,26,46,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(10,26,46,.026)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(120%_90%_at_42%_12%,#000,transparent_76%)]" />
        <div className="relative mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(10,26,46,.12)] bg-white/60 py-1.5 pr-3.5 pl-2.5">
              <span className="h-2 w-2 rounded-full bg-[#14989e] shadow-[0_0_0_4px_rgba(20,152,158,.18)]" />
              <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-[#41506a]">
                PRIVATE AI DECISION TOOL
              </span>
            </div>
            <h1 className="max-w-[880px] text-[clamp(40px,6vw,78px)] leading-[.99] font-bold text-[#0a1a2e]">
              Should your business use local AI or cloud AI?
            </h1>
            <p className="mt-7 max-w-[590px] text-[clamp(16px,1.6vw,20px)] leading-[1.6] text-[#46566c]">
              Answer seven questions and get a practical recommendation for
              local, cloud, or hybrid AI based on data sensitivity, control,
              compliance, speed, and workflow value.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="#questionnaire" size="lg" className="gap-2">
                Start the questionnaire <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="#answers" variant="secondary" size="lg">
                Read the guidance
              </ButtonLink>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <span
                  key={sector}
                  className="rounded-md bg-[rgba(20,152,158,.08)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#0f7a83]"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>

          <div
            data-spot
            data-reveal
            className="fss-card relative overflow-hidden rounded-[20px] border border-[rgba(10,26,46,.1)] bg-white p-8 opacity-0 transition-[opacity,transform,border-color] duration-700 ease-out"
            style={{ transform: "translateY(26px)" }}
          >
            <div
              data-glow
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
            />
            <div className="relative">
              <div className="mb-9 flex items-center justify-between gap-5">
                <div>
                  <p className="font-mono text-xs tracking-[0.14em] text-[#0f7a83]">
                    AI ROUTE
                  </p>
                  <h2 className="mt-3 text-[clamp(26px,3vw,36px)] leading-[1.06] font-semibold text-[#0a1a2e]">
                    Control where risk lives.
                  </h2>
                </div>
                <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] border border-[rgba(20,152,158,.25)] bg-[rgba(20,152,158,.1)] text-[#0f7a83]">
                  <BrainCircuit className="size-7" aria-hidden="true" />
                </span>
              </div>

              <div className="grid gap-3">
                {[
                  ["Local", "Private processing for sensitive workflows"],
                  ["Cloud", "Approved vendors for low-risk productivity"],
                  ["Hybrid", "The practical split for mixed environments"],
                ].map(([label, description]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 rounded-[14px] border border-[rgba(10,26,46,.08)] bg-[#f7f8f9] p-4"
                  >
                    <div>
                      <p className="font-semibold text-[#0a1a2e]">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-[#56657a]">
                        {description}
                      </p>
                    </div>
                    <ShieldCheck
                      className="size-5 shrink-0 text-[#0f7a83]"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>

              <p className="mt-7 text-sm leading-6 text-[#56657a]">
                FSS designs private AI agents and internal workflows that cut
                admin while keeping sensitive information under the right level
                of control.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f5] px-7 py-[clamp(70px,8vw,110px)]">
        <div className="mx-auto grid max-w-[1180px] gap-5 md:grid-cols-3">
          {insights.map((insight) => (
            <article
              key={insight.title}
              data-lift-light
              data-reveal
              className="rounded-[18px] border border-[rgba(10,26,46,.08)] bg-white p-7 opacity-0 transition-[opacity,transform,border-color,box-shadow] duration-700 ease-out"
              style={{ transform: "translateY(26px)" }}
            >
              <div className="mb-6 flex size-11 items-center justify-center rounded-[14px] bg-[rgba(20,152,158,.1)] text-[#0f7a83]">
                <insight.icon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold text-[#0a1a2e]">
                {insight.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#56657a]">
                {insight.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="questionnaire"
        className="bg-[#f2f3f5] px-7 py-[clamp(80px,10vw,130px)]"
      >
        <div className="mx-auto max-w-[1180px]">
          <div
            data-reveal
            className="mb-10 max-w-[760px] opacity-0 transition-[opacity,transform] duration-700 ease-out"
            style={{ transform: "translateY(26px)" }}
          >
            <p className="font-mono text-xs tracking-[0.14em] text-[#0f7a83]">
              FIND YOUR AI ROUTE
            </p>
            <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] leading-[1.04] font-semibold text-[#0a1a2e]">
              A practical decision before anyone buys the wrong AI tool.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#56657a] sm:text-lg sm:leading-8">
              The goal is not to force every workflow into one architecture. The
              goal is to put the right work in the right environment, then
              automate the admin that drains margin.
            </p>
          </div>
          <AiDeploymentQuiz />
        </div>
      </section>

      <section
        id="answers"
        className="bg-[#0a1a2e] px-7 py-[clamp(80px,10vw,130px)] text-[#e9eef5]"
      >
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div
            data-reveal
            className="opacity-0 transition-[opacity,transform] duration-700 ease-out"
            style={{ transform: "translateY(26px)" }}
          >
            <p className="font-mono text-xs tracking-[0.14em] text-[#46c7d8]">
              PRACTICAL ANSWERS
            </p>
            <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] leading-[1.04] font-semibold">
              Clear answers for the questions buyers already ask.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#9fb1c6]">
              These are the decision points behind local, cloud, and hybrid AI
              for firms that cannot afford careless data handling.
            </p>
          </div>

          <div className="grid gap-4">
            {aiQuestionnaireFaqs.map((faq) => (
              <article
                key={faq.question}
                data-spot
                data-reveal
                className="fss-card relative overflow-hidden rounded-[18px] border border-white/10 bg-white/[.035] p-6 opacity-0 transition-[opacity,transform,border-color] duration-700 ease-out"
                style={{ transform: "translateY(26px)" }}
              >
                <div
                  data-glow
                  className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
                />
                <div className="relative">
                  <h3 className="text-xl font-semibold text-[#fff]">
                    {faq.question}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#9fb1c6]">
                    {faq.answer}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f5] px-7 py-[clamp(80px,10vw,130px)]">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div
            data-reveal
            className="opacity-0 transition-[opacity,transform] duration-700 ease-out"
            style={{ transform: "translateY(26px)" }}
          >
            <p className="font-mono text-xs tracking-[0.14em] text-[#0f7a83]">
              PRIVATE AI WORKFLOW AUDIT
            </p>
            <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] leading-[1.04] font-semibold text-[#0a1a2e]">
              Turn a recommendation into a working internal workflow.
            </h2>
            <p className="mt-5 max-w-[620px] text-base leading-7 text-[#56657a]">
              FSS maps the data, risk, users, approvals, and profit leaks before
              building the first local, cloud, or hybrid AI workflow.
            </p>
          </div>
          <div
            data-reveal
            className="rounded-[20px] border border-[rgba(10,26,46,.08)] bg-white p-7 opacity-0 transition-[opacity,transform] duration-700 ease-out"
            style={{ transform: "translateY(26px)" }}
          >
            <ol className="space-y-4">
              {processSteps.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(20,152,158,.12)] font-mono text-xs text-[#0f7a83] ring-1 ring-[rgba(20,152,158,.35)]">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-[#56657a]">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap gap-3 border-t border-[rgba(10,26,46,.08)] pt-6">
              <ButtonLink href="#questionnaire" className="gap-2">
                Get your recommendation <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary">
                Talk to FSS
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
