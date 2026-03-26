import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const testimonials = [
  {
    quote: "FSS gave us a stable integration baseline in days instead of weeks.",
    author: "Mia Carter",
    role: "Head of Product, Orbitly",
  },
  {
    quote: "The SDK architecture made scaling between squads far less painful.",
    author: "Noah Kim",
    role: "Engineering Manager, Arrowline",
  },
  {
    quote: "Great defaults and strong docs meant fewer regressions after launch.",
    author: "Ava Singh",
    role: "Staff Engineer, Nucleus",
  },
];

export function TestimonialStrip() {
  return (
    <Section>
      <SectionHeading
        align="center"
        eyebrow="Social proof"
        title="Trusted by teams that ship quickly"
        description="Feedback from teams using FSS to streamline delivery and improve integration quality."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {testimonials.map((item) => (
          <blockquote key={item.author} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm leading-relaxed text-zinc-300">“{item.quote}”</p>
            <footer className="mt-4 text-xs text-zinc-500">
              <p className="font-semibold text-zinc-200">{item.author}</p>
              <p>{item.role}</p>
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}
