import {
  ArrowDownRight,
  BadgeCheck,
  Clock3,
  Droplets,
  Phone,
  Quote,
  Star,
} from "lucide-react";
import Image from "next/image";

import { TradeQuoteDemo } from "../../modules/trades/trade-quote-demo";
import { PreviewConceptBanner } from "../../preview-concept-banner";
import { PreviewOwnerCta } from "../../preview-owner-cta";
import { RevealOnScroll } from "../../reveal-on-scroll";
import type { TradeProspectPreview } from "@/lib/prospect-previews/types";

type ExamplePlumbingPreviewProps = {
  preview: TradeProspectPreview;
};

export function ExamplePlumbingPreview({
  preview,
}: ExamplePlumbingPreviewProps) {
  return (
    <div className="min-h-screen bg-[#ecfeff] text-cyan-950">
      <div className="border-b border-cyan-950/10 bg-white/65">
        <PreviewConceptBanner businessName={preview.businessName} />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a className="flex items-center gap-3" href="#top">
          <span className="grid size-11 place-items-center rounded-full bg-cyan-950 text-lg font-black text-lime-300 shadow-lg shadow-cyan-950/15">
            H
          </span>
          <span>
            <span className="block text-sm font-black tracking-tight">
              Harbourline Plumbing
            </span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-800/70">
              Local plumbing response
            </span>
          </span>
        </a>
        <a
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-950"
          href={`tel:${preview.phone.replace(/\s/g, "")}`}
        >
          <Phone aria-hidden="true" className="size-4 text-lime-300" />
          <span className="hidden sm:inline">{preview.phone}</span>
          <span className="sm:hidden">Call now</span>
        </a>
      </header>

      <main id="top">
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:pb-24 lg:pt-14">
          <RevealOnScroll className="relative z-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.21em] text-cyan-700">
              {preview.content.eyebrow}
            </p>
            <h1 className="mt-5 text-balance text-5xl font-black tracking-[-0.055em] text-cyan-950 sm:text-6xl lg:text-7xl">
              Plumbing help without the phone maze.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-900/75 sm:text-xl">
              {preview.content.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 py-4 text-sm font-black text-cyan-950 shadow-lg shadow-lime-500/20 transition hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-950"
                href="#request-help"
              >
                Tell us what is happening
                <ArrowDownRight aria-hidden="true" className="size-4" />
              </a>
              <a
                className="inline-flex min-h-13 items-center justify-center rounded-full border border-cyan-950/15 bg-white px-6 py-4 text-sm font-bold text-cyan-950 transition hover:border-cyan-950/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-950"
                href={`tel:${preview.phone.replace(/\s/g, "")}`}
              >
                Call for urgent help
              </a>
            </div>
          </RevealOnScroll>

          <RevealOnScroll
            className="relative isolate z-10 flex min-h-[25rem] overflow-hidden rounded-[2.25rem] bg-cyan-950 text-white shadow-2xl shadow-cyan-950/20 sm:min-h-[29rem]"
            delay={100}
          >
            <Image
              alt="A contemporary kitchen plumbing system with copper pipes and an emergency shut-off valve"
              className="-translate-y-8 scale-110 object-cover object-[58%_center]"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              src="/prospect-previews/example-plumbing/hero-v1.png"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,51,68,0.04)_0%,rgba(8,51,68,0.12)_36%,rgba(8,51,68,0.82)_100%)]" />
            <div className="relative flex w-full flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-200">
                  First response, simplified
                </p>
                <Droplets aria-hidden="true" className="size-7 text-lime-200" />
              </div>
              <div className="mt-auto rounded-[1.75rem] border border-white/15 bg-cyan-950/35 p-5 shadow-2xl shadow-cyan-950/30 sm:p-6">
                <div className="border-l border-lime-300/70 pl-5">
                  <p className="text-sm font-semibold text-cyan-100">
                    The customer shares
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    Problem, postcode, urgency.
                  </p>
                </div>
                <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <ResponseStep number="01" label="What happened?" />
                  <ResponseStep number="02" label="Where are you?" />
                  <ResponseStep number="03" label="How urgent?" />
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </section>

        <RevealOnScroll
          as="section"
          className="border-y border-cyan-950/10 bg-white/70"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
            <p className="flex items-center gap-3 text-sm font-bold text-cyan-950">
              <BadgeCheck aria-hidden="true" className="size-5 text-cyan-700" />
              A concept designed around qualified local requests, not a generic
              form.
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-800/75">
              <Clock3 aria-hidden="true" className="size-4" />
              {preview.content.responsePromise}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24"
          id="request-help"
          delay={80}
        >
          <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_.75fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.21em] text-cyan-700">
                Request assistance
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] text-cyan-950 sm:text-5xl">
                Get enough context to act, without making the homeowner repeat
                themselves.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-cyan-900/70">
              Every field earns its place. It guides the team toward an informed
              next step while keeping the request short enough for a stressful
              moment.
            </p>
          </div>
          <TradeQuoteDemo preview={preview} />
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="bg-cyan-950 py-16 text-white sm:py-20"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">
                Local reputation
              </p>
              <p className="mt-4 flex items-center gap-1 text-sm font-bold text-lime-300">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    aria-hidden="true"
                    className="size-4 fill-current"
                    key={index}
                  />
                ))}
                <span className="ml-2 text-cyan-100">
                  {preview.research.rating} from {preview.research.reviewCount}{" "}
                  reviews
                </span>
              </p>
            </div>
            <div className="relative border-l border-white/15 pl-7 sm:pl-10">
              <Quote
                aria-hidden="true"
                className="absolute -left-3 -top-3 size-6 fill-lime-300 text-lime-300"
              />
              <blockquote className="text-2xl font-bold leading-9 tracking-tight sm:text-3xl sm:leading-11">
                “{preview.content.reviews[0]?.quote}”
              </blockquote>
              <p className="mt-4 text-sm font-semibold text-cyan-200">
                {preview.content.reviews[0]?.author}
              </p>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-18"
        >
          <PreviewOwnerCta
            ownerCta={preview.ownerCta}
            prospectSlug={preview.slug}
          />
        </RevealOnScroll>
      </main>
    </div>
  );
}

type ResponseStepProps = {
  number: string;
  label: string;
};

function ResponseStep({ number, label }: ResponseStepProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <span className="text-xs font-black text-lime-300">{number}</span>
      <span className="text-sm font-bold text-white">{label}</span>
    </div>
  );
}
