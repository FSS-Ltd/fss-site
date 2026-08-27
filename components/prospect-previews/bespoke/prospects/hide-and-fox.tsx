import { Sparkles, Wine } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "experience",
    label: "What would you like to plan?",
    type: "select",
    options: [
      "Five-course tasting menu",
      "Eight-course tasting menu",
      "Vegetarian menu",
      "Exclusive hire",
    ],
  },
  { id: "date", label: "Preferred date", type: "date" },
  { id: "guests", label: "Number of guests", type: "text", placeholder: "2" },
  {
    id: "pairing",
    label: "Experience detail",
    type: "select",
    options: ["Wine pairing", "Dietary requirements", "Group of more than six"],
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

export function HideAndFoxPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#071b2b] text-[#f4efe4]"
      data-bespoke-prospect="hide-and-fox"
    >
      <div className="border-b border-[#caa93f]/20">
        <ConceptBar businessName="Hide and Fox" />
      </div>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-7 sm:px-8">
        <span className="font-serif text-2xl tracking-[.14em]">
          HIDE <i className="text-[#caa93f]">&</i> FOX
        </span>
        <a
          className="text-xs font-bold uppercase tracking-[.18em] text-[#d8c47f]"
          href="#experience"
        >
          Plan an experience
        </a>
      </header>
      <main>
        <section className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-12 px-5 pb-24 pt-8 sm:px-8 lg:grid-cols-[.85fr_1.15fr]">
          <RevealOnScroll className="max-w-xl">
            <p className="text-xs uppercase tracking-[.3em] text-[#caa93f]">
              Saltwood · Seasonal tasting menus
            </p>
            <h1 className="mt-7 font-serif text-5xl leading-[.98] tracking-[-.035em] sm:text-7xl">
              An evening composed, course by course.
            </h1>
            <p className="mt-7 text-lg font-light leading-8 text-[#cbd3d7]">
              A tasting-menu experience shaped by seasonal ingredients and
              thoughtful wine pairings. Plan a table or exclusive hire with the
              details considered from the start.
            </p>
            <a
              className="mt-9 inline-flex rounded-full border border-[#caa93f] px-6 py-3 text-sm font-bold text-[#eadb9f]"
              href="#experience"
            >
              Choose your dining experience
            </a>
          </RevealOnScroll>
          <RevealOnScroll
            className="relative h-[34rem] [perspective:1100px]"
            delay={100}
          >
            <div className="absolute left-[10%] top-[10%] size-[25rem] rounded-full bg-gradient-to-br from-[#f7f3e8] via-[#c9c4b8] to-[#676d70] shadow-[0_65px_100px_-35px_rgba(202,169,63,.48)] [transform:rotateX(63deg)_rotateZ(-9deg)]">
              <div className="absolute inset-[19%] rounded-full bg-[#ece2d3] shadow-inner">
                <div className="absolute left-[25%] top-[28%] h-20 w-36 rounded-[60%_40%_55%_45%] bg-gradient-to-br from-[#7b2833] to-[#31141d] shadow-lg" />
                <span className="absolute left-[38%] top-[16%] h-36 w-1 rotate-[28deg] bg-[#77935d]" />
                <span className="absolute right-[24%] top-[33%] size-9 rounded-full bg-[#caa93f]" />
              </div>
            </div>
            <div className="absolute right-[4%] top-[9%] h-56 w-24 rounded-b-[45%] rounded-t-2xl border-4 border-white/35 bg-gradient-to-b from-white/10 to-[#d3bd6c]/45 shadow-xl [transform:rotate(5deg)_translateZ(90px)]">
              <div className="absolute left-1/2 top-full h-28 w-1 -translate-x-1/2 bg-white/40" />
              <div className="absolute left-1/2 top-[calc(100%+7rem)] h-2 w-20 -translate-x-1/2 rounded-full bg-white/35" />
            </div>
            <Sparkles className="absolute bottom-[4%] left-[4%] size-9 text-[#caa93f]" />
          </RevealOnScroll>
        </section>
        <RevealOnScroll
          as="section"
          className="border-y border-[#caa93f]/20 py-12"
        >
          <div className="mx-auto grid max-w-6xl gap-8 px-5 text-center sm:grid-cols-3 sm:px-8">
            {[
              ["Five", "courses"],
              ["Eight", "courses"],
              ["One", "considered occasion"],
            ].map(([n, l]) => (
              <div key={n}>
                <p className="font-serif text-5xl text-[#caa93f]">{n}</p>
                <p className="mt-2 text-xs uppercase tracking-[.2em] text-white/55">
                  {l}
                </p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        <section
          className="bg-[#f3eee4] px-5 py-24 text-[#223852] sm:px-8"
          id="experience"
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <RevealOnScroll>
              <Wine className="size-9 text-[#9d7b16]" />
              <h2 className="mt-6 font-serif text-5xl tracking-tight">
                A reservation route for the details that matter.
              </h2>
              <p className="mt-5 leading-7 text-[#516272]">
                Menu, guest count, pairing and dietary context can reach the
                restaurant together without replacing its everyday reservation
                system.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Hide and Fox"
                buttonLabel="Prepare dining enquiry"
                fields={fields}
                formClassName="rounded-[2.5rem] bg-white p-6 shadow-xl sm:p-9"
                successTitle="Your dining enquiry is composed"
                successMessage="A live version could present the requested menu, date, guests and experience detail to Hide and Fox in one considered brief."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Hide and Fox" />
    </div>
  );
}
