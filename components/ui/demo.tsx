"use client";

import { Cloud, Cpu, ShieldCheck } from "lucide-react";

import { GlowCard } from "@/components/ui/spotlight-card";

const demoCards = [
  {
    title: "Secure Infrastructure",
    description: "Hardened cloud foundations and policy-first architecture.",
    glowColor: "blue" as const,
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    icon: ShieldCheck,
  },
  {
    title: "Automation Systems",
    description: "Workflow orchestration designed for reliability at scale.",
    glowColor: "purple" as const,
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80",
    icon: Cpu,
  },
  {
    title: "Cloud Operations",
    description: "Observability, resilience, and performance in one platform.",
    glowColor: "green" as const,
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80",
    icon: Cloud,
  },
];

export function Default() {
  return (
    <div className="flex min-h-screen w-screen flex-wrap items-center justify-center gap-10 p-10">
      {demoCards.map((card) => (
        <GlowCard key={card.title} className="overflow-hidden p-0" customSize glowColor={card.glowColor}>
          <div
            aria-hidden="true"
            className="h-44 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${card.image})` }}
          />
          <div className="space-y-3 p-5">
            <card.icon aria-hidden="true" className="size-5 text-brand-primary" />
            <p className="text-lg font-semibold text-foreground">{card.title}</p>
            <p className="text-sm text-text-muted">{card.description}</p>
          </div>
        </GlowCard>
      ))}
    </div>
  );
}
