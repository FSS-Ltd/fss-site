import { Calculator, ChevronRight } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "service",
    label: "What do you need help with?",
    type: "select",
    options: [
      "Company secretarial",
      "Payroll bureau",
      "Accounts production",
      "Taxation and VAT",
    ],
  },
  {
    id: "timing",
    label: "When would you like to talk?",
    type: "select",
    options: ["This week", "This month", "Planning ahead"],
  },
  {
    id: "company",
    label: "Business name",
    type: "text",
    placeholder: "Company",
  },
  {
    id: "email",
    label: "Work email",
    type: "email",
    placeholder: "name@company.co.uk",
  },
] as const;

export function BurfordsPage() {
  return (
    <div
      className="min-h-screen bg-white text-[#102a43]"
      data-bespoke-prospect="burfords"
    >
      <div className="bg-[#081f35] text-white">
        <ConceptBar businessName="Burfords" />
      </div>
      <main>
        <section className="relative overflow-hidden bg-[#eef7ff]">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-7 sm:px-8">
            <span className="text-2xl font-black tracking-[-.05em] text-[#176cae]">
              BURFORDS<span className="text-[#0b80d6]">.</span>
            </span>
            <a className="text-sm font-bold" href="#conversation">
              Start a conversation
            </a>
          </nav>
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-28">
            <RevealOnScroll className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#176cae]">
                Chartered certified accountants · Welling
              </p>
              <h1 className="mt-6 text-5xl font-black leading-[.96] tracking-[-.06em] sm:text-7xl">
                The right expertise, from the first question.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Company secretarial, payroll, accounts production and taxation
                support, routed by what needs attention now.
              </p>
              <a
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#176cae] px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-900/15"
                href="#conversation"
              >
                Choose accountancy support <ChevronRight className="size-4" />
              </a>
            </RevealOnScroll>
            <RevealOnScroll
              className="relative h-[30rem] [perspective:1200px]"
              delay={100}
            >
              <div className="absolute inset-x-[12%] bottom-[12%] top-[8%] rounded-[2.5rem] bg-gradient-to-br from-[#176cae] to-[#062a4b] shadow-[0_40px_80px_-24px_rgba(23,108,174,.55)] [transform:rotateY(15deg)_rotateX(4deg)]">
                <div className="absolute inset-5 overflow-hidden rounded-[1.8rem] border border-white/15 bg-[#0b3153] p-7 text-white">
                  <Calculator className="size-9 text-sky-300" />
                  <p className="mt-14 text-xs font-bold uppercase tracking-[.2em] text-sky-200">
                    Client brief
                  </p>
                  <p className="mt-3 text-3xl font-black">
                    Payroll
                    <br />
                    prepared.
                  </p>
                  <div className="mt-8 space-y-3">
                    {[72, 48, 83, 60].map((w, i) => (
                      <div className="h-2 rounded-full bg-white/10" key={i}>
                        <div
                          className="h-full rounded-full bg-sky-300"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-[3%] left-[1%] rounded-2xl bg-white p-5 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Four routes
                </p>
                <p className="mt-1 text-lg font-black text-[#176cae]">
                  One useful hand-off
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </section>
        <RevealOnScroll
          as="section"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8"
        >
          <div className="grid gap-px overflow-hidden rounded-[2rem] bg-slate-200 md:grid-cols-4">
            {[
              "Company secretarial",
              "Payroll bureau",
              "Accounts production",
              "Taxation & VAT",
            ].map((service) => (
              <div className="bg-white p-7" key={service}>
                <span className="block h-1 w-9 rounded-full bg-[#0b80d6]" />
                <h2 className="mt-12 text-xl font-black">{service}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Begin with the specific work, then add timing and business
                  context.
                </p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        <section
          className="bg-[#081f35] px-5 py-20 text-white sm:px-8"
          id="conversation"
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.22em] text-sky-300">
                Scoped before the call
              </p>
              <h2 className="mt-5 text-4xl font-black tracking-[-.045em] sm:text-6xl">
                Make the first conversation count.
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-300">
                A short route sends the enquiry toward the relevant work instead
                of leaving both sides to unpack a generic message.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Burfords"
                buttonLabel="Prepare accountancy enquiry"
                fields={fields}
                formClassName="rounded-[2rem] bg-white p-6 text-[#102a43] shadow-2xl sm:p-8"
                successTitle="The enquiry has been structured"
                successMessage="A live workflow could now route this request to the relevant Burfords expertise with its timing attached."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Burfords" />
    </div>
  );
}
