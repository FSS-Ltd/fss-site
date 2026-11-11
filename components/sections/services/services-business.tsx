import { ArrowRight, BarChart3, Check, Cloud, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";
import { Section } from "@/components/ui/section";

type ServiceCard = {
  icon: LucideIcon;
  title: string;
  bullets: string[];
};

const cards: ServiceCard[] = [
  {
    icon: BarChart3,
    title: "Custom ERP Solutions",
    bullets: [
      "Integrated financial modules",
      "Real-time supply chain tracking",
      "Automated reporting dashboards",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Cybersecurity Audits",
    bullets: [
      "Penetration testing",
      "Zero-trust architecture design",
      "Compliance readiness (GDPR/ISO)",
    ],
  },
  {
    icon: Cloud,
    title: "Cloud Migration",
    bullets: [
      "Azure/AWS specialized migration",
      "Serverless cost optimization",
      "Legacy system modernization",
    ],
  },
];

export function ServicesBusiness() {
  return (
    <Section className="bg-surface-1/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
        <div className="space-y-3 max-w-xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Enterprise &amp; Business Systems
          </h2>
          <p className="text-base leading-7 text-text-muted">
            Scalable, secure, and deeply integrated solutions built for organizations that
            cannot afford downtime or data loss.
          </p>
        </div>
        <ButtonLink href="/contact" variant="ghost" className="inline-flex items-center gap-1.5 shrink-0 text-brand-primary">
          Request a Consultation <ArrowRight className="size-4" />
        </ButtonLink>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <GlowCard key={card.title} customSize className="p-8">
            <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <card.icon className="size-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{card.title}</h3>
            <ul className="mt-4 space-y-2">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-text-muted">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
          </GlowCard>
        ))}
      </div>
    </Section>
  );
}
