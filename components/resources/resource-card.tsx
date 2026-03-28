import Image from "next/image";
import Link from "next/link";

import type { ResourceMeta } from "@/lib/types/resource";

import { ButtonLink } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";

type ResourceCardProps = {
  resource: ResourceMeta;
};

export function ResourceCard({ resource }: ResourceCardProps) {
  const resourceHref = "/resources/" + resource.slug;

  return (
    <GlowCard customSize className="flex flex-col p-0" as="article">
      <Link className="block" href={resourceHref}>
        <div className="overflow-hidden rounded-t-2xl">
          <Image
            src={resource.coverImage}
            alt=""
            width={900}
            height={540}
            className="h-44 w-full object-cover"
          />
        </div>
      </Link>
      <div className="space-y-4 p-6">
        <p className="text-xs uppercase tracking-[0.15em] text-text-subtle">
          {resource.category} • {resource.format}
        </p>
        <h2 className="text-xl font-semibold text-foreground">
          <Link href={resourceHref} className="transition hover:text-brand-primary">
            {resource.title}
          </Link>
        </h2>
        <p className="text-sm text-text-muted">{resource.shortDescription}</p>
        <ButtonLink href={resourceHref} variant="secondary" className="w-full">
          {resource.ctaLabel}
        </ButtonLink>
      </div>
    </GlowCard>
  );
}
