import {
  ArrowRight,
  CarFront,
  CircleCheckBig,
  Gauge,
  Phone,
  Wrench,
} from "lucide-react";
import Image from "next/image";

import { AutomotiveBookingDemo } from "../../modules/automotive/automotive-booking-demo";
import { PreviewConceptBanner } from "../../preview-concept-banner";
import { PreviewOwnerCta } from "../../preview-owner-cta";
import { RevealOnScroll } from "../../reveal-on-scroll";
import type { AutomotiveProspectPreview } from "@/lib/prospect-previews/types";

type AshfordAutoCentrePreviewProps = {
  preview: AutomotiveProspectPreview;
};

export function AshfordAutoCentrePreview({
  preview,
}: AshfordAutoCentrePreviewProps) {
  return (
    <div className="min-h-screen bg-[#fffaf4] text-[#15110d]">
      <div className="border-b border-orange-900/10 bg-orange-100/70">
        <PreviewConceptBanner businessName={preview.businessName} />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a className="flex items-center gap-3" href="#top">
          <span className="grid size-10 place-items-center rounded-xl bg-[#111827] text-sm font-black italic text-orange-300 shadow-lg shadow-slate-900/15">
            AAC
          </span>
          <span>
            <span className="block text-sm font-black uppercase tracking-[0.09em]">
              Ashford Auto Centre
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Independent garage
            </span>
          </span>
        </a>
        <a
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-900/15 bg-white px-4 py-2 text-sm font-bold transition hover:border-slate-900/35 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          href={`tel:${preview.phone.replace(/\s/g, "")}`}
        >
          <Phone aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{preview.phone}</span>
          <span className="sm:hidden">Call</span>
        </a>
      </header>

      <main id="top">
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-18 pt-8 sm:px-8 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:pb-28 lg:pt-14">
          <RevealOnScroll className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
              {preview.content.eyebrow}
            </p>
            <h1 className="mt-5 text-balance text-5xl font-black tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
              MOT, Servicing &amp; Repairs in Ashford
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
              {preview.content.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-orange-400 px-6 py-4 text-sm font-black text-slate-950 shadow-lg shadow-orange-400/25 transition hover:bg-orange-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                href="#booking"
              >
                Check MOT availability
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
              <a
                className="inline-flex min-h-13 items-center justify-center rounded-xl border border-slate-950/15 bg-white px-6 py-4 text-sm font-bold text-slate-900 transition hover:border-slate-950/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                href={`tel:${preview.phone.replace(/\s/g, "")}`}
              >
                Speak to the workshop
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-600">
              {[
                "Straightforward advice",
                "Local independent garage",
                "Clear booking journey",
              ].map((benefit) => (
                <span className="flex items-center gap-2" key={benefit}>
                  <CircleCheckBig
                    aria-hidden="true"
                    className="size-4 text-orange-600"
                  />
                  {benefit}
                </span>
              ))}
            </div>
          </RevealOnScroll>

          <RevealOnScroll
            className="relative isolate z-10 flex min-h-[27rem] overflow-hidden rounded-[2.5rem] bg-[#111827] text-white shadow-2xl shadow-slate-950/20 sm:min-h-[31rem]"
            delay={100}
          >
            <Image
              alt="A graphite hatchback inside a professionally lit independent garage workshop"
              className="-translate-y-12 scale-125 object-cover object-[68%_center]"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              src="/prospect-previews/ashford-auto-centre/hero-v1.png"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,14,28,0.12)_0%,rgba(7,14,28,0.08)_35%,rgba(7,14,28,0.78)_100%)]" />
            <div className="relative flex w-full flex-col p-6 sm:p-9">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-orange-200">
                <span>Workshop status</span>
                <span className="inline-flex items-center gap-2 text-emerald-200">
                  <span className="size-2 rounded-full bg-emerald-200" />
                  Open today
                </span>
              </div>
              <div className="mt-auto rounded-[2rem] border border-white/15 bg-slate-950/25 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Next practical step
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-white">
                      Begin with the car.
                    </p>
                  </div>
                  <span className="grid size-12 place-items-center rounded-2xl bg-orange-400 text-slate-950">
                    <CarFront aria-hidden="true" className="size-6" />
                  </span>
                </div>
                <div className="mt-10 grid grid-cols-3 gap-3">
                  <Metric icon={Gauge} label="MOT due" value="Check" />
                  <Metric icon={Wrench} label="Repair" value="Tell us" />
                  <Metric
                    icon={CircleCheckBig}
                    label="Booked"
                    value="Confirm"
                  />
                </div>
              </div>
              <p className="mt-6 max-w-md text-sm leading-6 text-slate-200">
                The concept turns the first visit into a useful conversation
                instead of making drivers search for a number and start again.
              </p>
            </div>
          </RevealOnScroll>
        </section>

        <RevealOnScroll
          as="section"
          className="border-y border-orange-900/10 bg-orange-100/60"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 sm:px-8 md:grid-cols-3">
            <ValueStatement
              title="1. Identify the car"
              detail="Registration gives the workshop a useful first detail."
            />
            <ValueStatement
              title="2. Clarify the job"
              detail="MOT, service, repair, or a prompt to ask for help."
            />
            <ValueStatement
              title="3. Make follow-up easy"
              detail="The customer details are ready for a quick response."
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24"
          id="booking"
          delay={80}
        >
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
              Digital booking concept
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Give every driver a clear next step.
            </h2>
          </div>
          <AutomotiveBookingDemo preview={preview} />
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="bg-[#111827] py-14 text-white sm:py-18"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                Built around the business
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Strong reviews deserve an equally clear first enquiry.
              </h2>
            </div>
            <p className="text-lg leading-8 text-slate-300">
              This concept combines the workshop&apos;s existing strengths with
              a journey that removes uncertainty for drivers ready to book.
            </p>
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

type MetricProps = {
  icon: typeof Gauge;
  label: string;
  value: string;
};

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <Icon aria-hidden="true" className="size-4 text-orange-300" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

type ValueStatementProps = {
  title: string;
  detail: string;
};

function ValueStatement({ title, detail }: ValueStatementProps) {
  return (
    <div>
      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}
