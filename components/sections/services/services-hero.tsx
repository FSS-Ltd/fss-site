import Image from "next/image";

import { Section } from "@/components/ui/section";

export function ServicesHero() {
  return (
    <Section>
      <div className="grid gap-12 md:grid-cols-2 items-center">
        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-primary">
            Our Expertise
          </p>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight">
            Engineering Trust Through{" "}
            <span className="text-brand-primary">Precision.</span>
          </h1>
          <p className="text-lg leading-relaxed text-text-muted">
            Faithful Software Solutions Ltd provides specialized digital architecture for
            institutions where reliability is not optional. From global enterprises to local
            communities.
          </p>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border-soft/40">
          <Image
            src="/images/illustrations/services-hero.svg"
            alt="Isometric software architecture illustration"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </Section>
  );
}
