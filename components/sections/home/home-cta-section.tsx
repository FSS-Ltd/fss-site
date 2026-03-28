import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function HomeCtaSection() {
  return (
    <Section className="pt-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-accent to-brand-primary/80 px-6 py-16 text-center shadow-2xl sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <span className="absolute -left-10 -top-10 text-[300px] font-bold text-white/20 select-none">
            &lt;/&gt;
          </span>
        </div>
        <div className="relative z-10 space-y-5">
          <h2 className="text-3xl font-extrabold italic tracking-tight text-cta-text sm:text-4xl">
            Ready to build your digital foundation?
          </h2>
          <p className="mx-auto max-w-2xl text-lg font-medium text-cta-text/80">
            Join hundreds of institutions that trust Faithful Software Solutions for their
            mission-critical technology.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <ButtonLink
              href="/contact"
              variant="secondary"
              size="lg"
              className="border-cta-text/30 bg-background text-foreground hover:bg-surface-1"
            >
              Get Your Custom Quote
            </ButtonLink>
            <ButtonLink
              href="/resources"
              variant="secondary"
              size="lg"
              className="border-cta-text/30 bg-transparent text-cta-text hover:bg-white/10"
            >
              View Resources
            </ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  );
}
