import Link from "next/link";
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
      <p className="mt-4 max-w-2xl text-sm text-text-subtle">
        Need implementation context first? Browse the{" "}
        <Link href="/blog" className="text-brand-primary hover:underline">
          FSS blog
        </Link>{" "}
        before downloading a resource.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.slug} resource={resource} />
        ))}
      </div>
    </Section>
  );
}
