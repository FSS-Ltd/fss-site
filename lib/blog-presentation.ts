import type { BlogPostMeta } from "@/lib/types/blog";

export type ArticleHeading = { id: string; text: string };

export type CategoryGroup = {
  category: string;
  id: string;
  posts: BlogPostMeta[];
};

/** Anchor id for a heading or section label. Must match on both render paths. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/** Plain text of a Markdown heading: links keep their label, emphasis and code marks go. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

/** The article's h2s, in order, ignoring anything inside fenced code. */
export function extractHeadings(body: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  let inFence = false;

  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const match = inFence ? null : /^## (.+)$/.exec(line.trim());
    if (!match) continue;
    const text = stripInlineMarkdown(match[1]);
    const id = slugifyHeading(text);
    if (text && id) headings.push({ id, text });
  }

  return headings;
}

/** A contents list only earns its space from three sections up. */
export function shouldShowContents(headings: ArticleHeading[]): boolean {
  return headings.length >= 3;
}

/**
 * Lead story: the newest featured post, otherwise the newest post.
 * Expects posts sorted newest first, as getAllBlogPosts returns them.
 */
export function selectLeadStory(posts: BlogPostMeta[]): {
  lead: BlogPostMeta | undefined;
  rest: BlogPostMeta[];
} {
  const lead = posts.find((post) => post.featured) ?? posts[0];
  return { lead, rest: posts.filter((post) => post !== lead) };
}

/** Sections in order of their newest post; posts keep their incoming order. */
export function groupByCategory(posts: BlogPostMeta[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const post of posts) {
    const group = groups.get(post.category);
    if (group) group.posts.push(post);
    else
      groups.set(post.category, {
        category: post.category,
        id: `section-${slugifyHeading(post.category)}`,
        posts: [post],
      });
  }
  return [...groups.values()];
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-04-02" as "2 April 2026", independent of the server's time zone. */
export function formatEditorialDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** Newest modified or published date across the posts, for the masthead dateline. */
export function latestUpdate(posts: BlogPostMeta[]): string | undefined {
  return posts
    .map((post) => post.modifiedDate ?? post.publishDate)
    .sort()
    .at(-1);
}
