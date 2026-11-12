import Link from "next/link";
import cta from "@/components/ui/cta-motion.module.css";
import fill from "@/components/ui/cta-fill.module.css";
import gutter from "@/components/ui/gutter.module.css";
import type { ReactNode } from "react";

import type { BlogPostMeta } from "@/lib/types/blog";

import {
  type ArticleHeading,
  buildEditionNetwork,
  formatEditorialDate,
  shouldShowContents,
} from "@/lib/blog-presentation";
import { ArticleRoute } from "@/components/blog/article-route";
import { ArticleEvidence } from "@/components/blog/article-evidence";
import { BlogBreadcrumbs } from "@/components/blog/blog-breadcrumbs";
import { EditionNetwork } from "@/components/blog/edition-network";
import { BlogPostCard, PostCover } from "@/components/blog/blog-post-card";
import styles from "@/components/blog/blog.module.css";

type BlogPostLayoutProps = {
  post: BlogPostMeta;
  headings: ArticleHeading[];
  relatedPosts: BlogPostMeta[];
  /** Every published article, for the edition network. */
  allPosts?: BlogPostMeta[];
  children: ReactNode;
};

export function BlogPostLayout({
  post,
  headings,
  relatedPosts,
  allPosts = [],
  children,
}: BlogPostLayoutProps) {
  const network = buildEditionNetwork(
    allPosts.some((candidate) => candidate.slug === post.slug)
      ? allPosts
      : [...allPosts, post],
  );
  const updated =
    post.modifiedDate && post.modifiedDate !== post.publishDate
      ? post.modifiedDate
      : undefined;

  return (
    <div className={`${styles.page} ${gutter.gutter}`}>
      <div className={styles.progress} aria-hidden="true" />
      <article className={styles.article}>
        <header className={styles.articleHead} data-motion-reveal="mask">
          <BlogBreadcrumbs title={post.title} />
          <div className={styles.kicker}>
            <Link
              href="/blog"
              className={`${styles.label} ${cta.link}`}
            >
              {post.category}
            </Link>
            <span>Field Notes</span>
          </div>
          <h1 className={styles.title}>{post.title}</h1>
          <p className={styles.articleStandfirst}>
            {post.summary ?? post.excerpt}
          </p>
          <p className={`${styles.metaLine} ${styles.byline}`}>
            <span>
              By{" "}
              <Link href="/about" className={cta.link}>
                {post.author}
              </Link>
            </span>
            <span>
              Published{" "}
              <time dateTime={post.publishDate}>
                {formatEditorialDate(post.publishDate)}
              </time>
            </span>
            {updated ? (
              <span>
                Updated{" "}
                <time dateTime={updated}>{formatEditorialDate(updated)}</time>
              </span>
            ) : null}
            <span>{post.readingMinutes} min read</span>
          </p>
          <EditionNetwork network={network} currentSlug={post.slug} compact />
        </header>

        {post.coverImage ? (
          <figure className={styles.cover} data-motion-reveal="up">
            <PostCover
              post={post}
              priority
              sizes="(min-width: 1260px) 1180px, 100vw"
            />
          </figure>
        ) : null}

        <div className={styles.columns}>
          {shouldShowContents(headings) ? (
            <ArticleRoute headings={headings} />
          ) : null}
          <div className={styles.prose}>{children}</div>
        </div>
      </article>

      <aside className={styles.endnotes} aria-label="About this article">
        <p className={styles.endMark}>End of article</p>

        <section aria-labelledby="about-article">
          <h2 id="about-article" className={styles.endHeading}>
            About this article
          </h2>
          <div className={styles.about}>
            {post.summary ? (
              <ArticleEvidence post={post} />
            ) : (
              <p>
                Written by {post.author} for Faithful Software Solutions.
              </p>
            )}
            <p>
              Faithful Software Solutions is a UK studio. We add AI to the
              systems businesses already use, automate repeated work and build
              custom software, for owner-led firms through to large teams.
            </p>
            <ul className={styles.tags} aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.contact} aria-labelledby="article-contact">
          <h2 id="article-contact" className={styles.endHeading}>
            Weighing up a similar decision?
          </h2>
          <p>
            Tell us about the process or system in question and we will
            suggest what to do first, including whether you need a build at
            all.
          </p>
          <Link
            href="/contact"
            className={`${styles.contactLink} ${cta.sweep} ${fill.rust}`}
            data-magnetic
          >
            <span data-mag-label className="inline-flex items-center gap-2">
              Talk to FSS <span aria-hidden="true">→</span>
            </span>
          </Link>
        </section>

        {relatedPosts.length ? (
          <section aria-labelledby="read-next">
            <h2 id="read-next" className={styles.endHeading}>
              Read next
            </h2>
            <div className={styles.nextList}>
              {relatedPosts.map((related) => (
                <BlogPostCard key={related.slug} post={related} network={network} />
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
