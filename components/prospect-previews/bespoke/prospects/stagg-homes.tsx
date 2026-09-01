import { Home, KeyRound, MapPin, MessageCircle } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { StaggHomesCinematicHero } from "./stagg-homes-cinematic-hero";

const fields = [
  {
    id: "move",
    label: "What are you planning?",
    options: [
      "Sell a property",
      "Let a property",
      "Buy a home",
      "Find a rental",
    ],
    type: "select",
  },
  {
    id: "postcode",
    label: "Property postcode",
    placeholder: "ME10",
    type: "text",
  },
  {
    id: "timing",
    label: "When would you like to move?",
    options: [
      "As soon as possible",
      "Within three months",
      "Within six months",
      "I am planning ahead",
    ],
    type: "select",
  },
  {
    id: "email",
    label: "Email",
    placeholder: "you@example.co.uk",
    type: "email",
  },
] as const;

const servicePrinciples = [
  {
    Icon: Home,
    body: "A personal, hands-on service from first question to completion.",
    title: "Owner-led",
  },
  {
    Icon: MessageCircle,
    body: "One consistent point of contact and practical guidance at every stage.",
    title: "Clear communication",
  },
  {
    Icon: MapPin,
    body: "A Kent agency with a focused understanding of its market.",
    title: "Local knowledge",
  },
] as const;

export function StaggHomesPage() {
  return (
    <div
      className="min-h-screen bg-[#f4efe6] text-[#173b4d]"
      data-bespoke-prospect="stagg-homes"
    >
      <ConceptBar businessName="Stagg Homes" />
      <main>
        <StaggHomesCinematicHero />

        <section className="mx-auto grid max-w-7xl gap-px bg-[#173b4d]/15 md:grid-cols-3">
          {servicePrinciples.map(({ Icon, title, body }) => (
            <article className="bg-[#f4efe6] p-8" key={title}>
              <Icon aria-hidden="true" />
              <h2 className="mt-8 text-2xl font-black">{title}</h2>
              <p className="mt-3 leading-7 text-[#173b4d]/70">{body}</p>
            </article>
          ))}
        </section>

        <section
          className="mx-auto grid max-w-7xl gap-10 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10"
          id="valuation"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9b743b]">
              A better first conversation
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Begin with the move, not a blank message box.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#173b4d]/70">
              This demonstration prepares the useful context before Stagg Homes
              replies. Nothing is submitted.
            </p>
            <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white/70 p-5">
              <KeyRound />
              <span className="font-bold">
                A clear brief for an owner-led response.
              </span>
            </div>
          </div>
          <div className="rounded-[2rem] bg-[#173b4d] p-6 text-white shadow-2xl sm:p-9">
            <DemoEnquiry
              businessName="Stagg Homes"
              buttonLabel="Prepare my property brief"
              fields={fields}
              successMessage="A live version could route the property, postcode and timing to the right Stagg Homes conversation."
              successTitle="Your property brief is ready"
            />
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Stagg Homes" />
    </div>
  );
}
