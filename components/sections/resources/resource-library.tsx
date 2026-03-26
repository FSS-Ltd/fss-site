import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { leadMagnets } from "@/lib/content/lead-magnets";

export function ResourceLibrary() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Lead magnets"
        title="Resources to accelerate onboarding and rollout"
        description="Reusable collateral designed for acquisition funnels, onboarding, and enablement."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {leadMagnets.map((resource) => (
          <article
            key={resource.slug}
            className="rounded-2xl border border-border-soft/70 bg-surface-1/78 p-6 shadow-[inset_0_1px_0_rgba(140,180,220,0.08)]"
          >
            <h2 className="text-lg font-semibold text-foreground">{resource.title}</h2>
            <p className="mt-3 text-sm text-text-muted">{resource.description}</p>
            <ButtonLink href="/contact" variant="secondary" className="mt-6 w-full">
              {resource.ctaLabel}
            </ButtonLink>
          </article>
        ))}
      </div>
    </Section>
  );
}
