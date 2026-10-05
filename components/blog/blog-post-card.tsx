import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import type { BlogPostMeta } from "@/lib/types/blog";

type BlogPostCardProps = {
  post: BlogPostMeta;
};

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article
      data-lift-light
      className="group overflow-hidden rounded-[18px] border border-border-soft/70 bg-white transition-[border-color,box-shadow,transform] duration-300"
    >
      <Link className="block" href={`/blog/${post.slug}`}>
        <div className="relative h-52 overflow-hidden bg-[#eef0f2]">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/45 to-transparent" />
        </div>
      </Link>
      <div className="p-6 sm:p-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-brand-primary">
          {format(new Date(post.publishDate), "MMM d, yyyy")} /{" "}
          {post.readingMinutes} min read
        </p>
        <h2 className="mt-4 text-[22px] font-semibold leading-tight text-foreground">
          <Link
            className="transition hover:text-brand-primary"
            href={`/blog/${post.slug}`}
          >
            {post.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-6 text-text-muted">{post.excerpt}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-brand-accent/8 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-brand-primary"
            >
              {tag}
            </span>
          ))}
        </div>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary transition hover:text-foreground"
        >
          Read article <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
