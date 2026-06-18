import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

type CategoryCard = {
  label: string;
  sub: string;
  iconColor: string;
};

const categoryCards: CategoryCard[] = [
  { label: "Enterprise", sub: "Robust ERP & CRM", iconColor: "bg-brand-primary" },
  { label: "Education", sub: "LMS & Admin", iconColor: "bg-brand-accent" },
  { label: "Religious", sub: "Member Management", iconColor: "bg-[#b5c7e8]" },
  { label: "Non-Profit", sub: "Custom Dashboards", iconColor: "bg-[#b7c6f2]" },
];

export function HeroSection() {
  return (
    <Section className="relative overflow-hidden pb-12 pt-14 sm:pb-16 sm:pt-20 lg:pb-20 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-primary/6 to-transparent" />

      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-8">
          <span className="inline-flex items-center rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-primary">
            Digital Craftsmanship
          </span>

          <h1 className="max-w-xl font-[ui-sans-serif] text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
            Custom Software for{" "}
            <span className="text-brand-primary">
              Business
            </span>
            , Schools, and Churches
          </h1>

          <p className="max-w-md font-[ui-sans-serif] text-sm leading-6 text-text-muted sm:max-w-lg sm:text-lg sm:leading-8">
            We build unshakeable digital foundations with reliable technology solutions tailored
            to your unique mission and operational needs.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/contact" variant="primary" size="lg">
              Get a Quote
            </ButtonLink>
            <ButtonLink href="/#services" variant="secondary" size="lg">
              Our Services
            </ButtonLink>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="rounded-2xl border border-border-soft/45 bg-surface-1/72 p-6 shadow-[0_1rem_2rem_-1rem_black]">
            <div className="grid grid-cols-2 gap-3">
              {categoryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-border-soft/45 bg-surface-2/70 p-5"
                >
                  <span
                    className={`mb-3 block size-2.5 rounded-full ${card.iconColor}`}
                    aria-hidden="true"
                  />
                  <p className="font-bold text-foreground">{card.label}</p>
                  <p className="mt-0.5 text-xs text-text-subtle">{card.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
