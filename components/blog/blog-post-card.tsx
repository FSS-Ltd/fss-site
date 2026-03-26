import Image from "next/image";
import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";

import { ButtonLink } from "@/components/ui/button";

import { format } from "date-fns";

type BlogPostCardProps = {
  post: BlogPostMeta;
};

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border-soft/45 bg-surface-1/72 shadow-[inset_0_1px_0_rgba(140,180,220,0.06)]">
      <Link className="block" href={`/blog/${post.slug}`}>
        <Image
          src={post.coverImage}
          alt=""
          width={900}
          height={540}
          className="h-48 w-full object-cover"
        />
      </Link>
      <div className="p-6">
        <p className="text-xs uppercase tracking-[0.15em] text-text-subtle">
          {format(new Date(post.publishDate), "MMM d, yyyy")} • {post.readingMinutes} min read
        </p>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          <Link className="transition hover:text-brand-primary" href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm text-text-muted">{post.excerpt}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border-soft/40 bg-surface-2/60 px-2.5 py-1 text-xs text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
        <ButtonLink href={`/blog/${post.slug}`} variant="ghost" className="mt-5">
          Read article
        </ButtonLink>
      </div>
    </article>
  );
}
