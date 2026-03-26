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
          <article key={resource.slug} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">{resource.title}</h2>
            <p className="mt-3 text-sm text-zinc-400">{resource.description}</p>
            <ButtonLink href="/contact" variant="secondary" className="mt-6 w-full">
              {resource.ctaLabel}
            </ButtonLink>
          </article>
        ))}
      </div>
    </Section>
  );
}
