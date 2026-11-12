import Image from "next/image";
import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";
import { NetworkGlyph } from "@/components/blog/edition-network";
import { CoverTransition } from "@/components/blog/cover-transition";
import { type EditionNetwork, formatEditorialDate } from "@/lib/blog-presentation";
import styles from "@/components/blog/blog.module.css";

type CoverProps = {
  post: BlogPostMeta;
  sizes: string;
  priority?: boolean;
};

/** Cover image at a fixed 5:3 frame (the covers' native ratio, so baked-in
 *  titles stay whole), or a typographic panel when a post has none. Purely
 *  decorative: the headline link is the card's only link. Screenshots (not
 *  the SVG covers) are cropped to one legible region. */
export function PostCover({ post, sizes, priority = false }: CoverProps) {
  const isScreenshot = Boolean(post.coverImage) && !post.coverImage.endsWith(".svg");
  const className = [
    styles.frame,
    post.coverImage ? "" : styles.noCover,
    isScreenshot ? styles.screenshot : "",
  ].join(" ");

  return (
    <CoverTransition slug={post.slug}>
      <div className={className}>
        {post.coverImage ? (
          <Image src={post.coverImage} alt="" fill sizes={sizes} priority={priority} />
        ) : (
          <span aria-hidden="true">{post.category}</span>
        )}
      </div>
    </CoverTransition>
  );
}

export function PostMeta({
  post,
  withAuthor = false,
}: {
  post: BlogPostMeta;
  withAuthor?: boolean;
}) {
  return (
    <p className={styles.metaLine}>
      {withAuthor ? <span>By {post.author}</span> : null}
      <time dateTime={post.publishDate}>
        {formatEditorialDate(post.publishDate)}
      </time>
      <span>{post.readingMinutes} min read</span>
    </p>
  );
}

/** Secondary story, set as type: kicker, headline, dek, date and read time,
 *  a rust rule and a glyph of the article's node in the edition network. */
export function BlogPostCard({
  post,
  network,
}: {
  post: BlogPostMeta;
  network: EditionNetwork;
}) {
  return (
    <article className={styles.story} data-lift-light>
      <div className={styles.storyTop}>
        <p className={styles.label}>{post.category}</p>
        <NetworkGlyph network={network} slug={post.slug} />
      </div>
      <h3 className={styles.storyTitle}>
        <Link href={`/blog/${post.slug}`} className={styles.stretch}>
          <span className={styles.grow}>{post.title}</span>
        </Link>
      </h3>
      <p className={styles.storyExcerpt}>{post.excerpt}</p>
      <span className={styles.storyRule} aria-hidden="true" />
      <PostMeta post={post} />
    </article>
  );
}
