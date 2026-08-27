import { Beer, CalendarDays } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";

const fields = [
  {
    id: "occasion",
    label: "What are you planning?",
    type: "select",
    options: [
      "Group booking",
      "Birthday or celebration",
      "Special event",
      "Venue availability",
    ],
  },
  { id: "date", label: "Preferred date", type: "date" },
  {
    id: "group",
    label: "Approximate group size",
    type: "text",
    placeholder: "8 people",
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
  {
    id: "notes",
    label: "Anything the team should know?",
    type: "textarea",
    placeholder: "Accessibility, food or space requirements",
  },
] as const;

export function FugglesBeerCafePage() {
  return (
    <div
      className="min-h-screen overflow-hidden bg-[#f6e8cf] text-[#281510]"
      data-bespoke-prospect="fuggles-beer-cafe"
    >
      <div className="bg-[#281510] text-[#f6e8cf]">
        <ConceptBar businessName="Fuggles Beer Cafe" />
      </div>
      <main>
        <section className="relative min-h-[86vh] overflow-hidden">
          <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
            <span className="text-2xl font-black uppercase tracking-[-.06em]">
              FUGGLES<span className="text-[#f0523d]">.</span>
            </span>
            <a
              className="rounded-full bg-[#281510] px-5 py-2 text-sm font-bold text-white"
              href="#plan"
            >
              Plan a group visit
            </a>
          </header>
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.1fr_.9fr]">
            <RevealOnScroll className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[.25em] text-[#a13728]">
                Tunbridge Wells · Beer café
              </p>
              <h1 className="mt-5 max-w-4xl text-6xl font-black uppercase leading-[.82] tracking-[-.075em] sm:text-8xl lg:text-[7.3rem]">
                30 on tap.
                <br />
                <span className="text-[#f0523d]">100+</span> chilled.
                <br />
                Food all day.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#69443a]">
                The everyday offer stays immediate. Groups, celebrations and
                special events get a route that captures the details the team
                actually needs.
              </p>
            </RevealOnScroll>
            <RevealOnScroll
              className="relative mx-auto h-[34rem] w-full max-w-lg [perspective:1200px]"
              delay={120}
            >
              <div className="absolute bottom-[10%] left-[22%] h-[75%] w-[48%] rounded-b-[42%] rounded-t-[16%] border-[10px] border-white/55 bg-gradient-to-r from-[#7c2b1d] via-[#e7682f] to-[#6e241a] shadow-[0_55px_75px_-30px_rgba(80,31,20,.65)] [transform:rotateY(-12deg)]">
                <div className="absolute inset-x-3 top-4 h-[14%] rounded-full bg-[#f7d7a0] shadow-[0_9px_18px_rgba(255,242,210,.55)]" />
                <div className="absolute left-[21%] top-[28%] grid size-28 place-items-center rounded-full border-2 border-[#f6e8cf]/60 text-center text-xs font-black uppercase tracking-widest text-[#f6e8cf]">
                  Fuggles
                  <br />
                  Beer Café
                </div>
              </div>
              <div className="absolute right-[3%] top-[18%] grid size-24 place-items-center rounded-full bg-[#f0523d] text-white shadow-2xl [transform:translateZ(80px)]">
                <Beer className="size-10" />
              </div>
              <div className="absolute bottom-[5%] left-[2%] rounded-2xl bg-[#281510] p-5 text-[#f6e8cf] shadow-xl">
                <p className="text-xs uppercase tracking-widest text-white/45">
                  For more than a table
                </p>
                <p className="mt-1 font-black">Group · Event · Celebration</p>
              </div>
            </RevealOnScroll>
          </div>
        </section>
        <RevealOnScroll
          as="section"
          className="rotate-[-1deg] bg-[#f0523d] py-8 text-white"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap justify-around gap-6 px-5 text-xl font-black uppercase sm:text-3xl">
            <span>Thirty taps</span>
            <span>100+ bottles & cans</span>
            <span>Food all day</span>
          </div>
        </RevealOnScroll>
        <section
          className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.8fr_1.2fr]"
          id="plan"
        >
          <RevealOnScroll>
            <CalendarDays className="size-10 text-[#f0523d]" />
            <h2 className="mt-6 text-5xl font-black uppercase leading-[.9] tracking-[-.055em]">
              Make the unusual booking easy.
            </h2>
            <p className="mt-5 leading-7 text-[#69443a]">
              Standard reservations can stay standard. This route is for
              occasions that need a real conversation.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={80}>
            <DemoEnquiry
              businessName="Fuggles Beer Cafe"
              buttonLabel="Prepare booking request"
              fields={fields}
              formClassName="rounded-[2rem] border-2 border-[#281510] bg-[#fff8ec] p-6 shadow-[12px_12px_0_#281510] sm:p-9"
              successTitle="Your Fuggles plan is ready"
              successMessage="A live version could send the date, group size and occasion to the booking team as one clear request."
            />
          </RevealOnScroll>
        </section>
      </main>
      <OwnerInvitation businessName="Fuggles Beer Cafe" />
    </div>
  );
}
