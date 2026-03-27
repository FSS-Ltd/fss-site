import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function HeroSection() {
  return (
    <Section className="relative overflow-hidden pb-12 pt-14 sm:pb-16 sm:pt-18 lg:pb-20 lg:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(89,200,230,0.18),transparent_36%),radial-gradient(circle_at_82%_0%,rgba(38,61,103,0.5),transparent_42%)]" />
      <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary">Product infrastructure</p>
          <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.06]">
            Empower your product with our{" "}
            <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              versatile SDK
            </span>
          </h1>
          <p className="max-w-lg text-lg leading-8 text-text-muted">
            A scalable SDK foundation that helps engineering teams launch faster, reduce integration debt, and keep
            product delivery predictable.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/contact" variant="primary" size="lg">
              Start building
            </ButtonLink>
            <ButtonLink href="/resources" variant="secondary" size="lg">
              Explore resources
            </ButtonLink>
            <ButtonLink href="/blog" variant="ghost" size="lg">
              Read the blog
            </ButtonLink>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md rounded-[2rem] border border-border-strong/80 bg-gradient-to-b from-brand-secondary/35 to-surface-1 p-6 shadow-[0_30px_90px_-45px_rgba(89,200,230,0.8)]">
          <div className="pointer-events-none absolute -inset-px rounded-[2rem] border border-brand-primary/20" />
          <Image
            src="/FSS_V2.png"
            alt="FSS 3D product visual"
            width={420}
            height={420}
            className="h-auto w-full object-contain"
            priority
          />
        </div>
      </div>
    </Section>
  );
}
