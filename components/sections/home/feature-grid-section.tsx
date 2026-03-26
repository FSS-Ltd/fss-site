import { Activity, Blocks, Gauge, Shield } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const featureItems = [
  {
    title: "Best integration speed",
    description: "Reference flows and stable APIs let teams implement quickly with fewer blockers.",
    icon: <Blocks className="size-5" aria-hidden="true" />,
  },
  {
    title: "Reliable at scale",
    description: "Production-hardened infrastructure designed to keep workloads predictable.",
    icon: <Gauge className="size-5" aria-hidden="true" />,
  },
  {
    title: "Observability first",
    description: "Built-in telemetry hooks keep teams informed about adoption and reliability.",
    icon: <Activity className="size-5" aria-hidden="true" />,
  },
  {
    title: "Enterprise-ready",
    description: "Security controls, role clarity, and governance support for larger organizations.",
    icon: <Shield className="size-5" aria-hidden="true" />,
  },
];

export function FeatureGridSection() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Why FSS"
        title="A maintainable SDK foundation for fast product teams"
        description="The architecture emphasizes clarity, reliability, and repeatable delivery from launch to scale."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {featureItems.map((feature) => (
          <Card key={feature.title} title={feature.title} description={feature.description} icon={feature.icon} />
        ))}
      </div>
    </Section>
  );
}
