import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function HomeCtaSection() {
  return (
    <Section className="pt-12">
      <div className="rounded-3xl border border-border-strong/55 bg-gradient-to-r from-brand-secondary/50 via-surface-1 to-surface-2 px-6 py-12 text-center sm:px-10">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Ready to get started?</h2>
        <p className="mx-auto mt-3 max-w-xl text-text-muted">
          Speak with the FSS team to map your integration strategy and align rollout milestones.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <ButtonLink href="/contact" variant="primary" size="lg">
            Book a demo
          </ButtonLink>
          <ButtonLink href="/resources" variant="secondary" size="lg">
            View lead magnets
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
