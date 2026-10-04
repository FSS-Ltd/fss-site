import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { ResourceMeta } from "@/lib/types/resource";

type ResourceCardProps = {
  resource: ResourceMeta;
};

export function ResourceCard({ resource }: ResourceCardProps) {
  const resourceHref = "/resources/" + resource.slug;

  return (
    <article
      data-lift-light
      className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-border-soft/70 bg-white transition-[border-color,box-shadow,transform] duration-300"
    >
      <Link
        aria-label={`View ${resource.title}`}
        className="block"
        href={resourceHref}
      >
        <div className="relative h-48 overflow-hidden bg-[#eef0f2]">
          <Image
            src={resource.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/45 to-transparent" />
          {resource.featured ? (
            <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-brand-primary">
              FEATURED
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brand-primary">
          {resource.category} / {resource.format}
        </p>
        <h2 className="mt-4 text-[22px] leading-tight font-semibold text-foreground">
          <Link
            href={resourceHref}
            className="transition hover:text-brand-primary"
          >
            {resource.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          {resource.shortDescription}
        </p>
        <Link
          href={resourceHref}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary transition hover:text-foreground sm:mt-auto sm:pt-6"
        >
          {resource.ctaLabel}{" "}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
