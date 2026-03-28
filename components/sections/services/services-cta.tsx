import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function ServicesCta() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-accent to-brand-primary/80 p-12 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-cta-text sm:text-4xl">
          Ready to stabilize your digital future?
        </h2>
        <p className="mt-4 text-lg text-cta-text/80">
          Contact Faithful Software Solutions Ltd today for a technical assessment and strategic
          roadmap.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <ButtonLink
            href="/contact"
            variant="secondary"
            size="lg"
            className="border-cta-text/30 bg-background text-foreground"
          >
            Schedule a Consultation
          </ButtonLink>
          <ButtonLink
            href="/#case-studies"
            variant="secondary"
            size="lg"
            className="border-cta-text/30 bg-background text-foreground"
          >
            View Case Studies
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
