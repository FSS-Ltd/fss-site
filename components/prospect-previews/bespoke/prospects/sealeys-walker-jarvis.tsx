import { Building2, Gavel, Home, KeyRound } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "route",
    label: "What can Sealeys help with?",
    type: "select",
    options: [
      "Residential sales",
      "Lettings and management",
      "Commercial property",
      "Auctions",
    ],
  },
  {
    id: "postcode",
    label: "Property postcode or area",
    type: "postcode",
    placeholder: "DA11…",
  },
  {
    id: "timing",
    label: "What is your timing?",
    type: "select",
    options: ["Ready to move", "This season", "Planning ahead"],
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

const propertyRoutes = [
  { Icon: Home, label: "Residential sales" },
  { Icon: KeyRound, label: "Lettings & management" },
  { Icon: Building2, label: "Commercial property" },
  { Icon: Gavel, label: "Auctions" },
] as const;

export function SealeysWalkerJarvisPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#ffed00] text-[#1d1d1b]"
      data-bespoke-prospect="sealeys-walker-jarvis"
    >
      <ConceptBar businessName="Sealeys Walker Jarvis" />
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b-2 border-black px-5 py-6 sm:px-8">
        <span className="text-xl font-black uppercase leading-none">
          SEALEYS
          <br />
          <span className="text-xs tracking-[.22em]">Walker Jarvis</span>
        </span>
        <a
          className="border-2 border-black bg-black px-5 py-3 text-xs font-black uppercase text-[#ffed00]"
          href="#property-route"
        >
          Choose a property route
        </a>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl border-x-2 border-black lg:grid-cols-[1.05fr_.95fr]">
          <RevealOnScroll className="flex min-h-[42rem] flex-col justify-between border-b-2 border-black p-6 sm:p-12 lg:border-b-0 lg:border-r-2">
            <p className="text-xs font-black uppercase tracking-[.25em]">
              Gravesend property · Four specialist routes
            </p>
            <h1 className="max-w-3xl text-5xl font-black uppercase leading-[.88] tracking-[-.07em] sm:text-7xl">
              The right property team from the first click.
            </h1>
            <p className="max-w-xl text-lg leading-8">
              Sales, lettings, commercial and auctions each begin with different
              context. This concept asks for it before routing the enquiry.
            </p>
          </RevealOnScroll>
          <RevealOnScroll
            className="relative min-h-[42rem] overflow-hidden bg-[#1d1d1b] [perspective:1000px]"
            delay={90}
          >
            <div className="absolute bottom-[13%] left-[12%] right-[12%] top-[14%] [transform:rotateY(14deg)_rotateX(4deg)]">
              <div className="absolute bottom-0 left-0 h-[67%] w-[30%] bg-[#f1f1eb] shadow-xl">
                <span className="absolute left-[25%] top-[16%] size-10 bg-[#1d1d1b]" />
                <span className="absolute bottom-0 left-[32%] h-[38%] w-[36%] bg-[#ffed00]" />
              </div>
              <div className="absolute bottom-0 left-[34%] h-[83%] w-[32%] bg-[#b9b9b2] shadow-xl">
                <span className="absolute left-[24%] top-[16%] size-12 bg-[#1d1d1b]" />
                <span className="absolute bottom-0 left-[35%] h-[32%] w-[30%] bg-[#393934]" />
              </div>
              <div className="absolute bottom-0 right-0 h-[59%] w-[30%] bg-[#f1f1eb] shadow-xl">
                <span className="absolute left-[24%] top-[16%] size-10 bg-[#1d1d1b]" />
                <span className="absolute bottom-0 left-[32%] h-[39%] w-[36%] bg-[#ffed00]" />
              </div>
            </div>
            <div className="absolute bottom-6 left-6 right-6 grid grid-cols-4 gap-2 text-[#ffed00]">
              {[Home, KeyRound, Building2, Gavel].map((Icon, i) => (
                <span
                  className="grid h-16 place-items-center border border-[#ffed00]/30"
                  key={i}
                >
                  <Icon className="size-5" />
                </span>
              ))}
            </div>
          </RevealOnScroll>
        </section>
        <RevealOnScroll
          as="section"
          className="mx-auto grid max-w-7xl border-x-2 border-t-2 border-black sm:grid-cols-2 lg:grid-cols-4"
        >
          {propertyRoutes.map(({ Icon, label }) => (
            <article
              className="border-b-2 border-r-2 border-black p-7"
              key={label}
            >
              <Icon className="size-7" />
              <h2 className="mt-14 text-xl font-black uppercase">{label}</h2>
            </article>
          ))}
        </RevealOnScroll>
        <section
          className="bg-[#f5f3e9] px-5 py-24 sm:px-8"
          id="property-route"
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <RevealOnScroll>
              <p className="text-xs font-black uppercase tracking-[.22em]">
                Intelligent routing
              </p>
              <h2 className="mt-5 text-5xl font-black uppercase leading-[.9] tracking-[-.055em]">
                One front door. Four informed teams.
              </h2>
              <p className="mt-5 leading-7 text-black/65">
                Property route, area and timing arrive together, so the enquiry
                does not begin with a department switchboard.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <DemoEnquiry
                businessName="Sealeys Walker Jarvis"
                buttonLabel="Prepare property enquiry"
                fields={fields}
                formClassName="border-2 border-black bg-white p-6 shadow-[12px_12px_0_#1d1d1b] sm:p-9"
                successTitle="Your property route is ready"
                successMessage="A live version could send this enquiry to the relevant Sealeys team with its area and timing already clear."
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Sealeys Walker Jarvis" />
    </div>
  );
}
