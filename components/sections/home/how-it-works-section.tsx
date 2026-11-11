import { GlowCard } from "@/components/ui/spotlight-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    number: "01",
    title: "Discovery",
    description:
      "We dive deep into your workflow to identify bottlenecks and define your goals.",
  },
  {
    number: "02",
    title: "Blueprint",
    description:
      "Architecture design and technical specifications defined with precision.",
  },
  {
    number: "03",
    title: "Build",
    description:
      "Agile development with frequent updates and transparent progress throughout.",
  },
  {
    number: "04",
    title: "Deploy",
    description:
      "Seamless launch, staff training, and ongoing technical support.",
  },
];

export function HowItWorksSection() {
  return (
    <Section className="pt-12">
      <SectionHeading
        align="center"
        eyebrow="Our Process"
        title="How We Work"
        description="A disciplined four-stage approach that keeps every project on track, on budget, and built to last."
      />
      <ol className="mt-11 grid gap-4 md:grid-cols-4">
        {steps.map((step) => (
          <GlowCard
            key={step.title}
            customSize
            className="p-6 text-center"
            as="li"
          >
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border-4 border-surface-2 bg-surface-1 font-extrabold text-lg text-brand-primary">
              {step.number}
            </div>
            <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {step.description}
            </p>
          </GlowCard>
        ))}
      </ol>
    </Section>
  );
}
