import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const principles = [
  {
    eyebrow: "Dependable",
    eyebrowColor: "text-brand-primary",
    borderHover: "hover:border-brand-primary/20",
    title: "Built to Last",
    description:
      "We write software designed for longevity - clean architecture, documented decisions, and code that the next engineer can actually understand and extend.",
  },
  {
    eyebrow: "Transparent",
    eyebrowColor: "text-[#b7c6f2]",
    borderHover: "hover:border-[#b7c6f2]/20",
    title: "Honest From Day One",
    description:
      "No inflated estimates, no hidden scope. We scope clearly, communicate early when things shift, and deliver what we said we would.",
  },
  {
    eyebrow: "Precision-Driven",
    eyebrowColor: "text-[#b5c7e8]",
    borderHover: "hover:border-[#b5c7e8]/20",
    title: "Engineered With Care",
    description:
      "Every system we build - whether for a school, a church, or an enterprise - gets the same architectural precision and attention to operational reliability.",
  },
];

export function TestimonialStrip() {
  return (
    <Section id="values" className="pt-14">
      <div className="mb-12">
        <SectionHeading
          eyebrow="Why FSS"
          title="Engineering Principles We Don't Compromise On"
          description="We started FSS in 2025 because we believe software built with care produces better outcomes for the people who depend on it."
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {principles.map((principle) => (
          <article
            key={principle.title}
            className={`group rounded-xl border border-border-soft/40 bg-surface-2 p-8 transition-all ${principle.borderHover}`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${principle.eyebrowColor}`}>
              {principle.eyebrow}
            </p>
            <h3 className="mt-3 text-xl font-bold text-foreground">{principle.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{principle.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
