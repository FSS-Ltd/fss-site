import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

import type { BlogPostMeta } from "@/lib/types/blog";

import { ButtonLink } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";

type BlogPostCardProps = {
  post: BlogPostMeta;
};

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <GlowCard customSize className="flex flex-col p-0" as="article">
      <Link className="block" href={`/blog/${post.slug}`}>
        <div className="overflow-hidden rounded-t-2xl">
          <Image
            src={post.coverImage}
            alt=""
            width={900}
            height={540}
            className="h-48 w-full object-cover"
          />
        </div>
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
    </GlowCard>
  );
}
