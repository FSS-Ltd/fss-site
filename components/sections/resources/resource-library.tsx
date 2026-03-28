import Image from "next/image";
import Link from "next/link";

import type { ResourceMeta } from "@/lib/types/resource";

import { ButtonLink } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";
import { Container } from "@/components/ui/container";

type ResourceLibraryProps = {
  resources: ResourceMeta[];
};

function ResourceCard({ resource }: { resource: ResourceMeta }) {
  const href = "/resources/" + resource.slug;

  return (
    <GlowCard customSize className="group flex flex-col p-0" as="article">
      <Link href={href} className="block">
        <div className="relative overflow-hidden rounded-t-2xl h-52">
          <Image
            src={resource.coverImage}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 to-transparent" />
        </div>
      </Link>
      <div className="space-y-4 p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary">
          {resource.category} · {resource.format}
        </p>
        <h2 className="text-xl font-bold text-foreground">
          <Link href={href} className="transition hover:text-brand-primary">
            {resource.title}
          </Link>
        </h2>
        <p className="text-sm leading-relaxed text-text-muted">{resource.shortDescription}</p>
        <ButtonLink href={href} variant="primary" className="w-full justify-center">
          {resource.ctaLabel}
        </ButtonLink>
      </div>
    </GlowCard>
  );
}

export function ResourceLibrary({ resources }: ResourceLibraryProps) {
  return (
    <div className="py-14 sm:py-20 lg:py-24">
      {/* Hero strip */}
      <div className="relative overflow-hidden border-b border-border-soft/30 bg-surface-1/60 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(111,212,238,0.08),transparent_50%)]" />
        <Container className="relative text-center">
          <span className="inline-flex items-center rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-primary">
            Free Strategic Resources
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Modernize Your Organization's Software with Confidence
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
            Practical guides and playbooks for business leaders, school administrators, and
            faith-based organizations ready to make their next technology move.
          </p>
        </Container>
      </div>

      {/* Cards grid */}
      <Container className="mt-14">
        {resources.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {resources.map((resource) => (
              <ResourceCard key={resource.slug} resource={resource} />
            ))}
          </div>
        ) : (
          <p className="text-center text-text-muted">No resources available yet.</p>
        )}

        <GlowCard customSize className="mt-16 p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">Looking for implementation guidance?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted">
            Our blog covers architectural principles, sector-specific technology decisions, and
            real project insights from our engineering team.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <ButtonLink href="/blog" variant="secondary">
              Read the blog
            </ButtonLink>
            <Link href="/contact" className="text-sm font-bold text-brand-primary transition hover:text-foreground self-center">
              Talk to FSS →
            </Link>
          </div>
        </GlowCard>
      </Container>
    </div>
  );
}
