import { Building2, Church, GraduationCap, Handshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { ButtonLink } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";
import { Section } from "@/components/ui/section";

type CategoryCard = {
  icon: LucideIcon;
  label: string;
  sub: string;
  iconColor: string;
};

const categoryCards: CategoryCard[] = [
  { icon: Building2,     label: "Enterprise", sub: "Robust ERP & CRM",      iconColor: "text-brand-primary" },
  { icon: GraduationCap, label: "Education",  sub: "LMS & Admin",            iconColor: "text-brand-accent" },
  { icon: Church,        label: "Religious",  sub: "Member Management",       iconColor: "text-[#b5c7e8]" },
  { icon: Handshake,     label: "Non-Profit", sub: "Custom Dashboards",       iconColor: "text-[#b7c6f2]" },
];

export function HeroSection() {
  return (
    <Section className="relative overflow-hidden pb-12 pt-14 sm:pb-16 sm:pt-20 lg:pb-20 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-primary/6 to-transparent" />
      <BackgroundPaths />

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

          <p className="max-w-lg text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
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
          <div className="pointer-events-none absolute -inset-4 rounded-full bg-brand-primary/10 blur-3xl" />
          <GlowCard customSize className="p-6 shadow-2xl">
            <div className="grid grid-cols-2 gap-3">
              {categoryCards.map((card) => (
                <GlowCard key={card.label} customSize className="p-5">
                  <card.icon className={`mb-2 size-6 ${card.iconColor}`} aria-hidden="true" />
                  <p className="font-bold text-foreground">{card.label}</p>
                  <p className="mt-0.5 text-xs text-text-subtle">{card.sub}</p>
                </GlowCard>
              ))}
            </div>
          </GlowCard>
        </div>
      </div>
    </Section>
  );
}
