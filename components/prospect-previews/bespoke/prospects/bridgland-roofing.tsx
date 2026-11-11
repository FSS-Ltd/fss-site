import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  Landmark,
  PanelsTopLeft,
  ScanSearch,
} from "lucide-react";

import { RevealOnScroll } from "../../reveal-on-scroll";
import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { BridglandRoofingHero } from "./bridgland-roofing-hero";

type ServiceRoute = {
  detail: string;
  Icon: LucideIcon;
  title: string;
};

const serviceRoutes: readonly ServiceRoute[] = [
  {
    detail:
      "A condition-led visit that turns what is visible from the ground and roof level into a clear report.",
    Icon: ScanSearch,
    title: "Roof assessments",
  },
  {
    detail:
      "A careful route for listed buildings and traditional properties, shaped around the materials already in place.",
    Icon: Landmark,
    title: "Listed buildings",
  },
  {
    detail:
      "Slate, tile, Kent peg roofing and leadwork considered as parts of one weathering system.",
    Icon: PanelsTopLeft,
    title: "Traditional roofing",
  },
  {
    detail:
      "Repairs and installations scoped with the property, access and the required finish in view from the start.",
    Icon: ClipboardCheck,
    title: "Clear scope of work",
  },
];

const fields = [
  {
    id: "property",
    label: "What type of property is it?",
    type: "select",
    options: [
      "House",
      "Listed or heritage property",
      "Commercial property",
      "Other",
    ],
  },
  {
    id: "work",
    label: "What would you like help with?",
    type: "select",
    options: [
      "Roof assessment",
      "Repair",
      "New roof or replacement",
      "Leadwork or chimney repair",
      "Guttering",
    ],
  },
  {
    id: "postcode",
    label: "Property postcode",
    placeholder: "TN23…",
    type: "postcode",
  },
  {
    id: "context",
    label: "What should the team know?",
    placeholder: "A short note about the roof or timing",
    type: "textarea",
  },
] as const;

export function BridglandRoofingPage() {
  return (
    <div
      className="bridglandPage min-h-screen bg-[#f4f1eb] text-[#17201d]"
      data-bespoke-prospect="bridgland-roofing"
    >
      <ConceptBar businessName="Bridgland Roofing" />
      <main>
        <BridglandRoofingHero />

        <RevealOnScroll as="section" className="px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a31621]">
                  Heritage-first roofing
                </p>
                <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[.96] tracking-[-0.055em] sm:text-6xl">
                  Protect what makes the building feel like itself.
                </h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-[#59635e]">
                Bridgland is a family-run roofing business established in 1989,
                serving Kent and most of Sussex. This concept brings its
                specialist work into a clearer first conversation.
              </p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] bg-[#17201d]/12 sm:grid-cols-2 lg:grid-cols-4">
              {serviceRoutes.map(({ detail, Icon, title }) => (
                <article className="bg-[#fbfaf7] p-7 sm:p-8" key={title}>
                  <Icon
                    aria-hidden="true"
                    className="size-7 text-[#a31621]"
                    strokeWidth={1.65}
                  />
                  <h3 className="mt-14 text-2xl font-semibold tracking-[-0.045em]">
                    {title}
                  </h3>
                  <p className="mt-3 leading-7 text-[#59635e]">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <section className="bg-[#17201d] px-5 py-20 text-white sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,.85fr)_minmax(26rem,1.15fr)] lg:gap-20">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e4b3a6]">
                The better first question
              </p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[.96] tracking-[-0.055em] sm:text-6xl">
                What is the roof telling us now?
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/72">
                A roof assessment is not a sales detour. It is how the repair,
                replacement or conservation work starts with the right evidence.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <ol className="grid gap-3">
                {[
                  ["01", "Share the property context", "Property type, roof concern and postcode create a useful start."],
                  ["02", "Inspect the details that matter", "Slate, leadwork, ridges and weathering points are considered in context."],
                  ["03", "Plan the right next step", "The outcome is a clearer repair, installation or conservation conversation."],
                ].map(([number, title, detail]) => (
                  <li
                    className="grid gap-4 rounded-[1.35rem] border border-white/12 bg-white/[.06] p-5 sm:grid-cols-[3.5rem_1fr] sm:p-6"
                    key={number}
                  >
                    <span className="text-sm font-bold text-[#e4b3a6]">
                      {number}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em]">
                        {title}
                      </h3>
                      <p className="mt-2 leading-7 text-white/68">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </RevealOnScroll>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28" id="roof-brief">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,.82fr)_minmax(30rem,1.18fr)] lg:gap-20">
            <RevealOnScroll>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a31621]">
                Private concept demonstration
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-[.96] tracking-[-0.055em] sm:text-6xl">
                Begin with the roof, not a generic contact form.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-[#59635e]">
                A live version could give Bridgland the property and work
                context before they arrange a site visit or free estimate.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <DemoEnquiry
                businessName="Bridgland Roofing"
                buttonLabel="Prepare roof assessment request"
                fields={fields}
                formClassName="rounded-[1.75rem] bg-[#fbfaf7] p-6 shadow-[0_28px_70px_-38px_rgba(23,32,29,.55)] sm:p-8"
                successMessage="A live version could give Bridgland the property, work and roof context before they arrange the next step."
                successTitle="Your roof brief is ready"
              />
            </RevealOnScroll>
          </div>
        </section>
      </main>
      <OwnerInvitation businessName="Bridgland Roofing" />
    </div>
  );
}
