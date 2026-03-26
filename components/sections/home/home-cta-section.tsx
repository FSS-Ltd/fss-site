import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function HomeCtaSection() {
  return (
    <Section className="pt-12">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/8 to-white/[0.03] px-6 py-12 text-center sm:px-10">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Ready to get started?</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">
          Speak with the FSS team to map your integration strategy and align rollout milestones.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-4">
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
