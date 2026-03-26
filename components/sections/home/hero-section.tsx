import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function HeroSection() {
  return (
    <Section className="relative overflow-hidden pb-14 pt-18 sm:pb-20 sm:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.1),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.2),transparent_30%)]" />
      <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Product infrastructure</p>
          <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Empower your product with our versatile SDK
          </h1>
          <p className="max-w-lg text-lg text-zinc-300">
            A scalable SDK foundation that helps engineering teams launch faster, reduce integration debt, and keep
            product delivery predictable.
          </p>
          <div className="flex flex-wrap gap-4">
            <ButtonLink href="/contact" variant="primary" size="lg">
              Start building
            </ButtonLink>
            <ButtonLink href="/resources" variant="secondary" size="lg">
              Explore resources
            </ButtonLink>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-800/40 to-zinc-950/90 p-6 shadow-[0_30px_80px_-40px_rgba(56,189,248,0.7)]">
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
