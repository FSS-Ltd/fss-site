import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";
import { formatEditorialDate } from "@/lib/blog-presentation";
import styles from "@/components/blog/blog.module.css";

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

/** Read-next story, set as type: kicker, headline, dek, a rust rule, date and
 *  read time. The headline link is the card's only link. */
export function BlogPostCard({ post }: { post: BlogPostMeta }) {
  return (
    <article className={styles.story} data-lift-light>
      <p className={styles.label}>{post.category}</p>
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
