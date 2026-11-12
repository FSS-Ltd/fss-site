import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";

import { formatEditorialDate } from "@/lib/blog-presentation";

/** "About this article" facts, with the same date format as the rest of the
 *  blog (the shared ContentEvidence prints ISO dates). */
export function ArticleEvidence({ post }: { post: BlogPostMeta }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        By{" "}
        {post.authorUrl ? <Link href={post.authorUrl}>{post.author}</Link> : post.author}
      </p>
      <p>
        Published{" "}
        <time dateTime={post.publishDate}>{formatEditorialDate(post.publishDate)}</time>{" "}
        · Updated{" "}
        <time dateTime={post.modifiedDate}>{formatEditorialDate(post.modifiedDate)}</time>
      </p>
      {post.audience?.length ? <p>For {post.audience.join(", ")}.</p> : null}
      {post.reviewedBy ? (
        <p>
          Reviewed by {post.reviewedBy}
          {post.reviewedDate ? (
            <>
              {" "}
              on{" "}
              <time dateTime={post.reviewedDate}>
                {formatEditorialDate(post.reviewedDate)}
              </time>
            </>
          ) : null}
        </p>
      ) : null}
      {post.sources?.length ? (
        <details>
          <summary>Sources and evidence</summary>
          <ul className="mt-2 space-y-2">
            {post.sources.map((source) => (
              <li key={source.url}>
                <Link href={source.url}>{source.title}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-2">
            First-party scope and product information. Workflow examples are
            illustrative; no measured customer outcomes are claimed.
          </p>
        </details>
      ) : null}
    </div>
  );
}
