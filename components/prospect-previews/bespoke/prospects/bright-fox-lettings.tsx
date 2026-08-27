import { ArrowDown, KeyRound } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "service",
    label: "Which landlord service do you need?",
    type: "select",
    options: ["Let Only", "Rent Collection", "Full Management"],
  },
  {
    id: "property",
    label: "Property postcode",
    type: "postcode",
    placeholder: "TN1 1AA",
  },
  { id: "name", label: "Your name", type: "text", placeholder: "Name" },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

export function BrightFoxLettingsPage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f3efe9] text-[#2e2834]"
      data-bespoke-prospect="bright-fox-lettings"
    >
      <ConceptBar businessName="Bright Fox Lettings" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <a className="font-serif text-xl font-bold tracking-tight" href="#top">
          Bright Fox <span className="font-normal italic">Lettings</span>
        </a>
        <a
          className="rounded-full border border-[#50485b]/25 px-5 py-2 text-sm font-bold"
          href="#landlord-route"
        >
          Landlord services
        </a>
      </header>
      <main id="top">
        <section className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[.9fr_1.1fr]">
          <RevealOnScroll className="relative z-10 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#7b687b]">
              Royal Tunbridge Wells · Landlord services
            </p>
            <h1 className="mt-7 font-serif text-5xl leading-[.94] tracking-[-.045em] sm:text-7xl lg:text-[5.8rem]">
              Let your property. Keep the level of control you want.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#615968]">
              Choose Let Only, Rent Collection or Full Management before sharing
              your property details. A clearer start for landlords and the
              lettings team.
            </p>
            <a
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#50485b] px-6 py-4 text-sm font-bold text-white"
              href="#landlord-route"
            >
              Find your service <ArrowDown className="size-4" />
            </a>
          </RevealOnScroll>
          <RevealOnScroll
            className="relative mx-auto h-[32rem] w-full max-w-xl [perspective:1100px]"
            delay={120}
          >
            <div className="absolute left-[12%] top-[7%] h-[77%] w-[72%] rounded-[2.6rem] bg-[#50485b] shadow-[0_45px_80px_-25px_rgba(45,34,50,.55)] [transform:rotateY(-13deg)_rotateX(6deg)]">
              <div className="absolute inset-5 rounded-[2rem] bg-[#d8cfc3]">
                <div className="absolute bottom-0 left-[9%] h-[68%] w-[82%] bg-[#f7f1e9] shadow-inner [clip-path:polygon(0_18%,18%_0,36%_18%,53%_2%,70%_18%,84%_5%,100%_21%,100%_100%,0_100%)]" />
                <div className="absolute bottom-[8%] left-[22%] h-[38%] w-[20%] rounded-t-full bg-[#50485b]" />
                <div className="absolute bottom-[14%] right-[18%] grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      className="size-8 bg-[#b8a89b]/70 shadow-inner"
                      key={i}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-[9%] right-[3%] grid size-32 place-items-center rounded-full border border-white/70 bg-white/75 shadow-2xl backdrop-blur-xl [transform:translateZ(70px)]">
              <KeyRound className="size-12 text-[#50485b]" />
            </div>
            <div className="absolute left-[3%] top-[14%] rounded-2xl border border-white/70 bg-white/75 px-5 py-4 shadow-xl backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-widest text-[#776b78]">
                Your route
              </p>
              <p className="mt-1 font-serif text-xl">Let · Collect · Manage</p>
            </div>
          </RevealOnScroll>
        </section>
        <RevealOnScroll
          as="section"
          className="bg-[#50485b] px-5 py-16 text-[#f8f2eb] sm:px-8"
        >
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
            {[
              ["Let Only", "Marketing and tenant finding."],
              ["Rent Collection", "A defined route for ongoing rent."],
              ["Full Management", "Day-to-day property support."],
            ].map(([title, copy], i) => (
              <article className="border-t border-white/25 pt-5" key={title}>
                <span className="font-serif text-5xl text-white/25">
                  0{i + 1}
                </span>
                <h2 className="mt-7 text-xl font-bold">{title}</h2>
                <p className="mt-2 text-white/65">{copy}</p>
              </article>
            ))}
          </div>
        </RevealOnScroll>
        <RevealOnScroll
          as="section"
          className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]"
          id="landlord-route"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#7b687b]">
              A useful first conversation
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-6xl">
              Start with the property, not a generic contact box.
            </h2>
            <p className="mt-5 leading-7 text-[#615968]">
              This working route demonstrates how landlord needs can arrive with
              the right service and location context already attached.
            </p>
          </div>
          <DemoEnquiry
            businessName="Bright Fox Lettings"
            buttonLabel="Prepare landlord enquiry"
            fields={fields}
            formClassName="rounded-[2.5rem] bg-white p-6 shadow-[0_30px_80px_-45px_rgba(46,40,52,.55)] sm:p-9"
            successTitle="Your landlord route is ready"
            successMessage="In a live version, Bright Fox could receive the service choice and property context as one organised enquiry."
          />
        </RevealOnScroll>
      </main>
      <OwnerInvitation businessName="Bright Fox Lettings" />
    </div>
  );
}
