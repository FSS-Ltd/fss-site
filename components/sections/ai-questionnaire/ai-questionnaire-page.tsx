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
import { GlowCard } from "@/components/ui/spotlight-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

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
      <Section className="relative overflow-hidden pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-28">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-primary">
              Private AI decision tool
            </span>
            <div className="space-y-6">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:leading-tight">
                Should your business use local AI or cloud AI?
              </h1>
              <p className="max-w-2xl text-pretty text-lg leading-8 text-text-muted sm:text-xl sm:leading-9">
                Answer seven questions and get a practical recommendation for
                local, cloud, or hybrid AI based on data sensitivity, compliance
                pressure, speed, budget, and workflow value.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="#questionnaire" size="lg" className="gap-2">
                Start the questionnaire <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="#answers" variant="secondary" size="lg">
                Read the guidance
              </ButtonLink>
            </div>
            <div className="flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <span
                  key={sector}
                  className="rounded-full border border-border-soft bg-surface-2/55 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-text-muted"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>

          <GlowCard customSize className="p-5 sm:p-7">
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-brand-primary">
                    AI route
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    Control where risk lives.
                  </h2>
                </div>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                  <BrainCircuit className="size-6" aria-hidden="true" />
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
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border-soft bg-surface-2/55 p-4"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="mt-1 text-sm text-text-muted">
                        {description}
                      </p>
                    </div>
                    <ShieldCheck
                      className="size-5 shrink-0 text-brand-primary"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>

              <p className="text-sm leading-6 text-text-muted">
                FSS designs private AI agents and internal workflows that cut
                admin while keeping sensitive information under the right level
                of control.
              </p>
            </div>
          </GlowCard>
        </div>
      </Section>

      <Section className="bg-surface-1/55">
        <div className="grid gap-5 md:grid-cols-3">
          {insights.map((insight) => (
            <GlowCard key={insight.title} customSize className="p-6">
              <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <insight.icon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {insight.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                {insight.description}
              </p>
            </GlowCard>
          ))}
        </div>
      </Section>

      <Section id="questionnaire">
        <div className="mb-10 max-w-3xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">
            Find your AI route
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            A practical decision before anyone buys the wrong AI tool.
          </h2>
          <p className="text-pretty text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
            The goal is not to force every workflow into one architecture. The
            goal is to put the right work in the right environment, then
            automate the admin that drains margin.
          </p>
        </div>
        <AiDeploymentQuiz />
      </Section>

      <Section id="answers" className="bg-surface-1/55">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <SectionHeading
            eyebrow="Practical answers"
            title="Clear answers for the questions buyers already ask."
            description="These are the practical decision points behind local, cloud, and hybrid AI for firms that cannot afford careless data handling."
          />

          <div className="grid gap-4">
            {aiQuestionnaireFaqs.map((faq) => (
              <GlowCard key={faq.question} customSize className="p-5">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {faq.question}
                </h2>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  {faq.answer}
                </p>
              </GlowCard>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <SectionHeading
            eyebrow="Private AI Workflow Audit"
            title="Turn a recommendation into a working internal workflow."
            description="FSS maps the data, risk, users, approvals, and profit leaks before building the first local, cloud, or hybrid AI workflow."
          />
          <GlowCard customSize className="p-5 sm:p-7">
            <ol className="space-y-4">
              {processSteps.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-cta-text">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-text-muted">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap gap-3 border-t border-border-soft/70 pt-6">
              <ButtonLink href="#questionnaire" className="gap-2">
                Get your recommendation <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary">
                Talk to FSS
              </ButtonLink>
            </div>
          </GlowCard>
        </div>
      </Section>
    </>
  );
}
