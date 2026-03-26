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
    <Section className="pt-14">
      <SectionHeading
        align="center"
        eyebrow="Social proof"
        title="Trusted by teams that ship quickly"
        description="Feedback from teams using FSS to streamline delivery and improve integration quality."
      />
      <div className="mt-11 grid gap-4 lg:grid-cols-3">
        {testimonials.map((item) => (
          <blockquote
            key={item.author}
            className="rounded-2xl border border-border-soft/70 bg-surface-1/78 p-5 shadow-[inset_0_1px_0_rgba(140,180,220,0.08)]"
          >
            <p className="text-sm leading-relaxed text-text-muted">“{item.quote}”</p>
            <footer className="mt-4 text-xs text-text-subtle">
              <p className="font-semibold text-foreground">{item.author}</p>
              <p>{item.role}</p>
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}
