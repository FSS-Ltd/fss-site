import { ArrowRight } from "lucide-react";

import { BusinessIntakeForm } from "@/components/sections/business-intake/business-intake-form";
import { ButtonLink } from "@/components/ui/button";

type Faq = {
  question: string;
  answer: string;
};

export const businessIntakeFaqs: Faq[] = [
  {
    question: "Will you tell me whether I need an app or a website?",
    answer:
      "Yes. Once we've reviewed your answers, we'll tell you whether an app, a website, or building an audience first is the right next step for where your idea is today.",
  },
  {
    question: "What if I don't have any evidence people want this yet?",
    answer:
      "That's a normal, useful answer. It often means the right first move is building an audience or running a small demand test before committing to a product build.",
  },
  {
    question: "Is this a sales form?",
    answer:
      "No. It's a review. We'll only suggest working together if a build genuinely makes sense for where you are.",
  },
  {
    question: "How long does it take?",
    answer:
      "Around 5–10 minutes. The more detail you share about the problem and your goals, the more useful the review.",
  },
];

export function BusinessIntakePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#f2f3f5] px-7 pb-16 pt-[138px]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,26,46,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(10,26,46,.026)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(120%_90%_at_42%_12%,#000,transparent_76%)]" />
        <div className="relative mx-auto max-w-[760px] text-center">
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(10,26,46,.12)] bg-white/60 py-1.5 pr-3.5 pl-2.5">
            <span className="h-2 w-2 rounded-full bg-[#14989e] shadow-[0_0_0_4px_rgba(20,152,158,.18)]" />
            <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-[#41506a]">
              BUSINESS IDEA REVIEW
            </span>
          </div>
          <h1 className="text-[clamp(36px,5.5vw,58px)] leading-[1.03] font-bold text-[#0a1a2e]">
            Tell us about your idea. We&apos;ll tell you what to build first.
          </h1>
          <p className="mx-auto mt-6 max-w-[560px] text-[clamp(16px,1.6vw,19px)] leading-[1.6] text-[#46566c]">
            Answer a few questions about your idea, your goals, and the evidence you have so
            far. We&apos;ll review it and tell you whether the right first move is a website,
            an app, or building an audience before you build anything.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="#idea-form" size="lg" className="gap-2">
              Start the review <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      <section id="idea-form" className="bg-[#f2f3f5] px-7 py-[clamp(60px,8vw,100px)]">
        <div className="mx-auto max-w-[760px]">
          <BusinessIntakeForm />
        </div>
      </section>

      <section className="bg-[#0a1a2e] px-7 py-[clamp(80px,10vw,130px)] text-[#e9eef5]">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <p className="font-mono text-xs tracking-[0.14em] text-[#46c7d8]">
              QUESTIONS
            </p>
            <h2 className="mt-4 text-[clamp(30px,4.4vw,52px)] leading-[1.04] font-semibold">
              What to expect from the review.
            </h2>
          </div>

          <div className="grid gap-4">
            {businessIntakeFaqs.map((faq) => (
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
                  <h3 className="text-xl font-semibold text-[#fff]">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#9fb1c6]">{faq.answer}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
