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
      className="group overflow-hidden rounded-[18px] border border-[rgba(10,26,46,.08)] bg-white transition-[border-color,box-shadow,transform] duration-300"
    >
      <Link className="block" href={resourceHref}>
        <div className="relative h-48 overflow-hidden bg-[#eef0f2]">
          <Image
            src={resource.coverImage}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/45 to-transparent" />
        </div>
      </Link>
      <div className="space-y-4 p-6 sm:p-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#0f7a83]">
          {resource.category} / {resource.format}
        </p>
        <h2 className="text-[22px] leading-tight font-semibold text-[#0a1a2e]">
          <Link href={resourceHref} className="transition hover:text-[#0f7a83]">
            {resource.title}
          </Link>
        </h2>
        <p className="text-sm leading-6 text-[#56657a]">
          {resource.shortDescription}
        </p>
        <Link
          href={resourceHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0a1a2e] px-5 py-3 text-sm font-semibold text-[#fff] transition hover:bg-[#102642]"
        >
          {resource.ctaLabel}{" "}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
