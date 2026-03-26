import type { ResourceMeta } from "@/lib/types/resource";

import { ResourceCard } from "@/components/resources/resource-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

type ResourceLibraryProps = {
  resources: ResourceMeta[];
};

export function ResourceLibrary({ resources }: ResourceLibraryProps) {
  return (
    <Section>
      <SectionHeading
        eyebrow="Lead magnets"
        title="Resources to accelerate onboarding and rollout"
        description="Conversion-focused assets designed to help teams plan and execute implementation faster."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.slug} resource={resource} />
        ))}
      </div>
    </Section>
  );
}
