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
    <Section>
      <SectionHeading
        align="center"
        eyebrow="How it works"
        title="A practical rollout model for shipping faster"
        description="Start with a single team, validate outcomes, and expand to additional journeys with minimal rework."
      />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-zinc-300">0{index + 1}</p>
            <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
