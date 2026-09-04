import type { BlogPostMeta } from "@/lib/types/blog";
import { canonicalUrl } from "./metadata";
import { organisation } from "./organisation";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssFeed(posts: BlogPostMeta[]): string {
  const items = posts
    .filter((post) => post.indexable)
    .map((post) => {
      const url = escapeXml(canonicalUrl(`/blog/${post.slug}`));
      return `<item><title>${escapeXml(post.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeXml(post.excerpt)}</description><pubDate>${new Date(post.publishDate).toUTCString()}</pubDate></item>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(organisation.name)}</title><link>${organisation.url}/blog</link><description>Practical software guidance from Faithful Software Solutions.</description><language>en-GB</language><atom:link href="${organisation.url}/feed.xml" rel="self" type="application/rss+xml"/>${items.join("")}</channel></rss>`;
}
