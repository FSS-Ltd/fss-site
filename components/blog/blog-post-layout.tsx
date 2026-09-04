import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { format } from "date-fns";

import type { BlogPostMeta } from "@/lib/types/blog";

import { Container } from "@/components/ui/container";
import { ContentBreadcrumbs } from "@/components/seo/content-breadcrumbs";
import { ContentEvidence } from "@/components/seo/content-evidence";

type BlogPostLayoutProps = {
  post: BlogPostMeta;
  children: ReactNode;
};

export function BlogPostLayout({ post, children }: BlogPostLayoutProps) {
  return (
    <article className="pt-24 pb-14 sm:py-20 lg:py-24">
      <Container className="max-w-3xl">
        <ContentBreadcrumbs parent="Blog" title={post.title} />
        <header className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
            {post.category}
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {post.title}
          </h1>
          <p className="text-lg text-text-muted">
            {post.summary ?? post.excerpt}
          </p>
          <p className="text-sm text-text-subtle">
            {format(new Date(post.publishDate), "MMMM d, yyyy")} •{" "}
            {post.readingMinutes} min read • {post.author}
          </p>
        </header>
        {post.summary && (
          <div className="mt-6">
            <ContentEvidence content={post} />
          </div>
        )}

        <figure className="mt-10 overflow-hidden rounded-3xl border border-border-soft/45 bg-surface-1/72">
          <Image
            src={post.coverImage}
            alt={post.title}
            width={1200}
            height={700}
            className="h-auto w-full object-cover"
            priority
          />
        </figure>

        <section className="mt-10 space-y-4 text-base leading-8 text-text-muted">
          {children}
        </section>

        <footer className="mt-12 border-t border-border-soft/35 pt-6">
          <p className="text-sm text-text-subtle">
            Explore implementation resources in{" "}
            <Link
              href="/resources"
              className="text-brand-primary hover:underline"
            >
              the resource library
            </Link>
            , or{" "}
            <Link
              href="/contact"
              className="text-brand-primary hover:underline"
            >
              talk to FSS
            </Link>
            .
          </p>
        </footer>
      </Container>
    </article>
  );
}
