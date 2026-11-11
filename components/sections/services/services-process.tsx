import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    number: "01",
    title: "Discovery",
    description: "We dive deep into your workflow to identify bottlenecks and define your goals.",
  },
  {
    number: "02",
    title: "Blueprint",
    description: "Architecture design and technical specifications defined with precision.",
  },
  {
    number: "03",
    title: "Build",
    description: "Agile development with frequent updates and transparent progress throughout.",
  },
  {
    number: "04",
    title: "Deploy",
    description: "Seamless launch, staff training, and ongoing technical support.",
  },
];

export function ServicesProcess() {
  return (
    <Section>
      <SectionHeading
        align="center"
        eyebrow="Our Process"
        title="How We Work"
        description="A disciplined four-stage approach that keeps every project on track, on budget, and built to last."
      />
      <ol className="relative mt-11 grid gap-4 md:grid-cols-4">
        <li className="pointer-events-none hidden md:block absolute left-0 top-10 w-full px-[10%]">
          <div className="h-px w-full bg-border-soft/40" />
        </li>
        {steps.map((step) => (
          <li key={step.title} className="relative flex flex-col items-center text-center px-4">
            <div className="relative z-10 mb-5 flex size-20 items-center justify-center rounded-full border-4 border-surface-2 bg-surface-1 font-extrabold text-xl text-brand-primary">
              {step.number}
            </div>
            <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
