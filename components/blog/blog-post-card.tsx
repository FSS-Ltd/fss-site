import Image from "next/image";
import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";
import cta from "@/components/ui/cta-motion.module.css";

import { CoverTransition } from "@/components/blog/cover-transition";
import { formatEditorialDate } from "@/lib/blog-presentation";
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

/** Secondary story: "Also in this edition" and "Read next". */
export function BlogPostCard({
  post,
  showExcerpt = false,
}: {
  post: BlogPostMeta;
  showExcerpt?: boolean;
}) {
  return (
    <article className={styles.story} data-lift-light>
      <PostCover
        post={post}
        sizes="(min-width: 1100px) 380px, (min-width: 640px) 50vw, 100vw"
      />
      <div className={styles.storyBody}>
        <p className={styles.label}>{post.category}</p>
        <h3 className={styles.storyTitle}>
          <Link href={`/blog/${post.slug}`} className={`${cta.link} ${styles.stretch}`}>
            {post.title}
          </Link>
        </h3>
        {showExcerpt ? (
          <p className={styles.storyExcerpt}>{post.excerpt}</p>
        ) : null}
        <PostMeta post={post} />
      </div>
    </article>
  );
}
