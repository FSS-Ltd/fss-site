import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    title: "Connect and configure",
    description: "Install the SDK and configure your first integration through a guided setup path.",
  },
  {
    title: "Instrument outcomes",
    description: "Track product events and funnel quality with a shared KPI taxonomy.",
  },
  {
    title: "Scale with confidence",
    description: "Promote patterns across teams using reusable modules and launch checklists.",
  },
];

export function HowItWorksSection() {
  return (
    <Section className="pt-12">
      <SectionHeading
        align="center"
        eyebrow="How it works"
        title="A practical rollout model for shipping faster"
        description="Start with a single team, validate outcomes, and expand to additional journeys with minimal rework."
      />
      <ol className="mt-11 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-2xl border border-border-soft/70 bg-surface-1/78 p-5 shadow-[inset_0_1px_0_rgba(140,180,220,0.08)]"
          >
            <p className="inline-flex size-7 items-center justify-center rounded-full bg-brand-secondary/60 text-xs font-semibold text-brand-primary">
              0{index + 1}
            </p>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
