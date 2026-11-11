import Image from "next/image";
import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";
import cta from "@/components/ui/cta-motion.module.css";

import { formatEditorialDate } from "@/lib/blog-presentation";
import styles from "@/components/blog/blog.module.css";

type CoverProps = {
  post: BlogPostMeta;
  sizes: string;
  priority?: boolean;
  /** Link the image to the post; the headline link stays the accessible one. */
  linked?: boolean;
};

/** Cover image at a fixed 5:3 frame, or a typographic panel when a post has none. */
export function PostCover({ post, sizes, priority = false, linked = true }: CoverProps) {
  const inner = post.coverImage ? (
    <Image
      src={post.coverImage}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
    />
  ) : (
    <span aria-hidden="true">{post.category}</span>
  );
  const className = `${styles.frame} ${post.coverImage ? "" : styles.noCover}`;

  return linked ? (
    <Link
      href={`/blog/${post.slug}`}
      className={className}
      tabIndex={-1}
      aria-hidden="true"
    >
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
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
          <Link href={`/blog/${post.slug}`} className={cta.link}>
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
