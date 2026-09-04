import Link from "next/link";
import type { ContentEvidence as Evidence } from "@/lib/seo/content";

export function ContentEvidence({
  content,
}: {
  content: Evidence & { publishDate?: string; author?: string };
}) {
  return (
    <div className="space-y-3 text-sm text-text-muted">
      {content.author && (
        <p>
          By{" "}
          {content.authorUrl ? (
            <Link href={content.authorUrl} className="underline">
              {content.author}
            </Link>
          ) : (
            content.author
          )}
        </p>
      )}
      <p>
        {content.publishDate && (
          <>
            Published{" "}
            <time dateTime={content.publishDate}>{content.publishDate}</time>{" "}
            ·{" "}
          </>
        )}
        Updated{" "}
        <time dateTime={content.modifiedDate}>{content.modifiedDate}</time>
      </p>
      {content.audience?.length ? (
        <p>For {content.audience.join(", ")}.</p>
      ) : null}
      {content.reviewedBy && (
        <p>
          Reviewed by {content.reviewedBy}
          {content.reviewedDate && (
            <>
              {" "}
              on{" "}
              <time dateTime={content.reviewedDate}>
                {content.reviewedDate}
              </time>
            </>
          )}
        </p>
      )}
      {content.sources?.length ? (
        <details>
          <summary className="cursor-pointer">Sources and evidence</summary>
          <ul className="mt-2 space-y-2">
            {content.sources.map((source) => (
              <li key={source.url}>
                <Link className="underline" href={source.url}>
                  {source.title}
                </Link>
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
