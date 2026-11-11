import type { BlogPostMeta } from "@/lib/types/blog";
import type { ResourceMeta } from "@/lib/types/resource";
import { canonicalUrl, type PageMetadataInput } from "./metadata";
import { organisation } from "./organisation";

type Entry = { title: string; path: string; description: string };

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

const section = (heading: string, entries: Entry[]) =>
  entries.length === 0
    ? ""
    : `## ${heading}\n\n${entries
        .map(
          (e) =>
            `- [${oneLine(e.title)}](${canonicalUrl(e.path)}): ${oneLine(e.description)}`,
        )
        .join("\n")}\n`;

export function llmsTxtResponse(
  allowIndexing: boolean,
  build: () => string,
): Response {
  if (!allowIndexing) return new Response("Not found", { status: 404 });
  return new Response(build(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function buildLlmsTxt(
  pages: Record<string, PageMetadataInput>,
  posts: BlogPostMeta[],
  resources: ResourceMeta[],
): string {
  // Same predicates as app/sitemap.ts. Posts and resources come from their
  // own lists, so their page entries are skipped.
  const indexed = Object.values(pages).filter(
    (p) =>
      p.index &&
      !p.path.startsWith("/blog/") &&
      !p.path.startsWith("/resources/"),
  );
  const services = indexed.filter((p) => p.path.startsWith("/services/"));
  const guides = indexed.filter((p) =>
    ["/guides/", "/work/", "/sectors/"].some((prefix) =>
      p.path.startsWith(prefix),
    ),
  );
  const company = indexed.filter(
    (p) => !services.includes(p) && !guides.includes(p),
  );

  return [
    `# ${organisation.name}\n\n> ${organisation.summary}\n`,
    section("Services", services),
    section("Guides and case studies", guides),
    section(
      "Articles",
      posts
        .filter((p) => p.indexable)
        .map((p) => ({
          title: p.seoTitle,
          path: `/blog/${p.slug}`,
          description: p.seoDescription,
        })),
    ),
    section(
      "Resources",
      resources
        .filter((r) => r.indexable)
        .map((r) => ({
          title: r.seoTitle,
          path: `/resources/${r.slug}`,
          description: r.seoDescription,
        })),
    ),
    section("Pages", company),
  ]
    .filter(Boolean)
    .join("\n");
}
