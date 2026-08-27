import { BarChart3, CircleDollarSign } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "service",
    label: "What would you like to discuss?",
    type: "select",
    options: [
      "Accounting and taxation",
      "Business advice",
      "Individual tax",
      "Business tax",
    ],
  },
  {
    id: "client",
    label: "Who is the advice for?",
    type: "select",
    options: ["Limited company", "Sole trader", "Partnership", "Individual"],
  },
  {
    id: "timing",
    label: "When would you like to talk?",
    type: "select",
    options: ["This week", "This month", "Planning ahead"],
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

export function WormaldAccountantsPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f5f7fb] text-[#092454]"
      data-bespoke-prospect="wormald-accountants"
    >
      <ConceptBar businessName="Wormald Accountants" />
      <main>
        <section className="relative bg-white">
          <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-7 sm:px-8">
            <span className="text-2xl font-black tracking-[-.05em] text-[#093b9f]">
              WORMALD<span className="text-[#c7071d]">+</span>
            </span>
            <a className="text-sm font-black text-[#093b9f]" href="#advice">
              Start with your need
            </a>
          </header>
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-8 sm:px-8 lg:grid-cols-[1fr_1fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#c7071d]">
                Accounting · Taxation · Business advice
              </p>
              <h1 className="mt-6 text-5xl font-black leading-[.94] tracking-[-.06em] sm:text-7xl">
                Make sense of the numbers that shape what comes next.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Accounting and tax advice built around the business or
                individual, with the service need and timing clear before the
                first conversation.
              </p>
              <a
                className="mt-8 inline-flex rounded-full bg-[#093b9f] px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-900/20"
                href="#advice"
              >
                Choose accountancy support
              </a>
            </RevealOnScroll>
            <RevealOnScroll
              className="relative h-[34rem] [perspective:1100px]"
              delay={100}
            >
              <div className="absolute inset-x-[13%] bottom-[12%] top-[7%] [transform:rotateY(-14deg)_rotateX(7deg)]">
                <div className="absolute bottom-0 left-0 h-[31%] w-[27%] rounded-t-2xl bg-gradient-to-r from-[#0a327e] to-[#1d62cd] shadow-xl" />
                <div className="absolute bottom-0 left-[34%] h-[55%] w-[27%] rounded-t-2xl bg-gradient-to-r from-[#8f0713] to-[#db1f2e] shadow-xl" />
                <div className="absolute bottom-0 right-0 h-[82%] w-[27%] rounded-t-2xl bg-gradient-to-r from-[#08296a] to-[#1356bd] shadow-xl" />
                <div className="absolute inset-x-[-8%] bottom-0 h-5 rounded-full bg-[#dfe4ee] shadow-[0_25px_60px_-12px_rgba(9,59,159,.5)]" />
              </div>
              <div className="absolute left-[2%] top-[11%] grid size-24 place-items-center rounded-full bg-white text-[#c7071d] shadow-2xl [transform:translateZ(85px)]">
                <CircleDollarSign className="size-10" />
              </div>
              <div className="absolute bottom-[2%] right-[2%] rounded-2xl bg-[#092454] p-5 text-white shadow-xl">
                <BarChart3 className="size-6 text-[#ee5965]" />
                <p className="mt-4 text-xs uppercase tracking-widest text-white/45">
                  Structured start
                </p>
                <p className="mt-1 font-black">Need · Client · Timing</p>
              </div>
            </RevealOnScroll>
          </div>
        </section>
        <RevealOnScroll
          as="section"
          className="bg-[#093b9f] px-5 py-16 text-white sm:px-8"
        >
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              "Accounting & taxation",
              "Business advice",
              "Individual tax",
              "Business tax",
            ].map((x, i) => (
              <article className="border-l border-white/20 pl-5" key={x}>
                <span className="font-mono text-[#ff8f99]">0{i + 1}</span>
                <h2 className="mt-7 text-xl font-black">{x}</h2>
              </article>
            ))}
          </div>
        </RevealOnScroll>
        <section className="px-5 py-24 sm:px-8" id="advice">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#c7071d]">
                A better first brief
              </p>
              <h2 className="mt-5 text-5xl font-black leading-[.95] tracking-[-.055em]">
                Route the question before requesting the call.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                Service and client type give the accounts team a more useful
                starting point than an open text box.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Wormald Accountants"
                buttonLabel="Prepare accountancy enquiry"
                fields={fields}
                formClassName="rounded-[2.5rem] bg-white p-6 shadow-xl ring-1 ring-[#093b9f]/10 sm:p-9"
                successTitle="Your accountancy brief is ready"
                successMessage="A live version could route the service, client type and timing to the relevant Wormald conversation."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Wormald Accountants" />
    </div>
  );
}
