import { PackageCheck, Plane } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "supplies",
    label: "What are you sourcing?",
    type: "select",
    options: [
      "Everyday office supplies",
      "Workplace and warehouse",
      "Catering and cleaning",
      "Business credit account",
    ],
  },
  {
    id: "timing",
    label: "When do you need delivery?",
    type: "select",
    options: ["Next working day", "This week", "Planning a repeat order"],
  },
  {
    id: "company",
    label: "Company name",
    type: "text",
    placeholder: "Business",
  },
  {
    id: "email",
    label: "Work email",
    type: "email",
    placeholder: "name@business.co.uk",
  },
] as const;

export function PaperstonePage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f7f7fa] text-[#17213a]"
      data-bespoke-prospect="paperstone"
    >
      <ConceptBar businessName="Paperstone" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <span className="text-3xl font-black tracking-[-.07em]">
          paper<span className="text-[#eb4297]">stone</span>
        </span>
        <a
          className="rounded-full bg-[#17213a] px-5 py-2 text-sm font-bold text-white"
          href="#supply-route"
        >
          Find a supply route
        </a>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.1fr_.9fr]">
          <RevealOnScroll>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#eb4297]">
              Business supplies · Next-working-day delivery
            </p>
            <h1 className="mt-5 text-6xl font-black leading-[.88] tracking-[-.075em] sm:text-8xl">
              60,000+ ways to keep work moving.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
              Office, workplace, warehouse, catering and cleaning supplies.
              Start with the category or account route, then give Paperstone a
              purchasing brief it can act on.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                className="rounded-full bg-[#eb4297] px-6 py-4 text-sm font-black text-white"
                href="#supply-route"
              >
                Choose supply need
              </a>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#17213a]/15 px-5 py-3 text-sm font-bold">
                <PackageCheck className="size-4" />
                Next-working-day option
              </span>
            </div>
          </RevealOnScroll>
          <RevealOnScroll
            className="relative h-[35rem] [perspective:1100px]"
            delay={100}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                className="absolute left-[18%] h-24 w-[64%] rounded-2xl border border-white bg-gradient-to-br from-white to-[#dfe3ef] shadow-[0_18px_32px_-14px_rgba(23,33,58,.35)]"
                key={i}
                style={{
                  top: `${12 + i * 12}%`,
                  transform: `rotateX(58deg) rotateZ(${-7 + i * 2}deg) translateZ(${i * 18}px)`,
                }}
              >
                <span className="absolute left-6 top-5 h-3 w-32 rounded bg-[#eb4297]/70" />
                <span className="absolute left-6 top-11 h-2 w-20 rounded bg-[#17213a]/15" />
              </div>
            ))}
            <div className="absolute right-[1%] top-[10%] grid size-24 place-items-center rounded-3xl bg-[#eb4297] text-white shadow-2xl [transform:rotate(8deg)_translateZ(90px)]">
              <Plane className="size-10" />
            </div>
            <div className="absolute bottom-[4%] left-[3%] rounded-2xl bg-[#17213a] px-6 py-5 text-white shadow-xl">
              <p className="text-xs uppercase tracking-widest text-white/45">
                From brief to basket
              </p>
              <p className="mt-1 text-xl font-black">Category first.</p>
            </div>
          </RevealOnScroll>
        </section>
        <RevealOnScroll
          as="section"
          className="bg-[#17213a] px-5 py-14 text-white sm:px-8"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-8">
            {[
              "Office",
              "Warehouse",
              "Catering",
              "Cleaning",
              "Credit account",
            ].map((x, i) => (
              <div key={x}>
                <span className="font-mono text-xs text-[#eb4297]">
                  0{i + 1}
                </span>
                <p className="mt-2 font-black">{x}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        <section
          className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.85fr_1.15fr]"
          id="supply-route"
        >
          <RevealOnScroll>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#eb4297]">
              Buying route
            </p>
            <h2 className="mt-5 text-5xl font-black leading-[.95] tracking-[-.055em]">
              Move from a huge catalogue to the right conversation.
            </h2>
            <p className="mt-5 leading-7 text-slate-600">
              This demonstration qualifies a business need without pretending to
              place an order or upload a supplier invoice.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={80}>
            <DemoEnquiry
              businessName="Paperstone"
              buttonLabel="Prepare supply request"
              fields={fields}
              formClassName="rounded-[2.5rem] border border-[#17213a]/10 bg-white p-6 shadow-xl sm:p-9"
              successTitle="Your supply route is ready"
              successMessage="A live version could route the category, delivery timing and company details to the right Paperstone team."
            />
          </RevealOnScroll>
        </section>
      </main>
      <OwnerInvitation businessName="Paperstone" />
    </div>
  );
}
