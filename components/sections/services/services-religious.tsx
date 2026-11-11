import { ArrowRight, Church, Heart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { GlowCard } from "@/components/ui/spotlight-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

type ServiceCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const cards: ServiceCard[] = [
  {
    icon: Church,
    title: "Community Engagement Apps",
    description:
      "Branded mobile apps for sermon streaming, event registration, and prayer requests.",
  },
  {
    icon: Heart,
    title: "Stewardship & Giving Portals",
    description:
      "Secure, low-friction donation systems integrated with financial management software.",
  },
];

export function ServicesReligious() {
  return (
    <Section className="bg-surface-1/60">
      <SectionHeading
        align="center"
        title="Religious & Faith-Based Tech"
        description="Faithful Software Solutions Ltd understands the unique needs of religious organizations. We bridge ancient missions with modern technology."
      />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <GlowCard key={card.title} customSize className="flex gap-6 p-8">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <card.icon className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{card.description}</p>
              <Link
                href="/contact"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
              >
                Learn More <ArrowRight className="size-4" />
              </Link>
            </div>
          </GlowCard>
        ))}
      </div>
    </Section>
  );
}
