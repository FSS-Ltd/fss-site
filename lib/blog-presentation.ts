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

/**
 * Archive layout: a section earns its own group from two articles up; every
 * other article goes into one chronological list (incoming order, newest first).
 */
export function splitArchive(posts: BlogPostMeta[]): {
  groups: CategoryGroup[];
  ungrouped: BlogPostMeta[];
} {
  const groups = groupByCategory(posts).filter((group) => group.posts.length >= 2);
  const grouped = new Set(groups.flatMap((group) => group.posts));
  return { groups, ungrouped: posts.filter((post) => !grouped.has(post)) };
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

export type NetworkNode = {
  slug: string;
  title: string;
  category: string;
  /** Position inside the edition network, 0 to 1 on both axes. */
  x: number;
  y: number;
};

export type NetworkRoute = {
  from: string;
  to: string;
  /** "chain" joins neighbours in publishing order; "related" joins articles sharing a section or tags. */
  kind: "chain" | "related";
};

export type EditionNetwork = { nodes: NetworkNode[]; routes: NetworkRoute[] };

/** Horizontal inset, so nodes keep clear of the edges. */
const NETWORK_PAD_X = 0.06;
const NETWORK_LANES = 3;
const NETWORK_LANE_TOP = 0.22;
const NETWORK_LANE_SPAN = 0.56;

/**
 * Edition network: one node per article. x follows publishing order (oldest
 * left), y is the article's section lane (sections take lanes in order of
 * their first article, wrapping after three). Routes join neighbours in
 * publishing order, plus each article to the earlier one it shares most with.
 * Same posts in, same layout out, whatever order they arrive in.
 */
export function buildEditionNetwork(posts: BlogPostMeta[]): EditionNetwork {
  const ordered = [...posts].sort(
    (a, b) =>
      a.publishDate.localeCompare(b.publishDate) || a.slug.localeCompare(b.slug),
  );
  const lanes = new Map<string, number>();
  for (const post of ordered) {
    if (!lanes.has(post.category)) lanes.set(post.category, lanes.size);
  }
  const laneCount = Math.min(lanes.size, NETWORK_LANES);
  const lastCol = Math.max(ordered.length - 1, 1);

  const nodes = ordered.map((post, index): NetworkNode => {
    const lane = (lanes.get(post.category) ?? 0) % NETWORK_LANES;
    return {
      slug: post.slug,
      title: post.title,
      category: post.category,
      x: ordered.length === 1 ? 0.5 : NETWORK_PAD_X + (index / lastCol) * (1 - 2 * NETWORK_PAD_X),
      y: laneCount < 2 ? 0.5 : NETWORK_LANE_TOP + (lane / (laneCount - 1)) * NETWORK_LANE_SPAN,
    };
  });

  // Related: each article also joins the earlier one it shares most with
  // (same section counts double, each shared tag once; ties go to the newer).
  const routes: NetworkRoute[] = [];
  ordered.forEach((post, index) => {
    const before = ordered[index - 1];
    if (before) routes.push({ from: before.slug, to: post.slug, kind: "chain" });
    let best: BlogPostMeta | undefined;
    let bestScore = 0;
    for (const earlier of ordered.slice(0, Math.max(index - 1, 0))) {
      const shared = (post.tags ?? []).filter((tag) => earlier.tags?.includes(tag)).length;
      const score = shared + (earlier.category === post.category ? 2 : 0);
      if (score > 0 && score >= bestScore) {
        best = earlier;
        bestScore = score;
      }
    }
    if (best) routes.push({ from: best.slug, to: post.slug, kind: "related" });
  });

  return { nodes, routes };
}

/** "Field Notes, 7 articles": the count comes from the posts, never typed. */
export function editionLabel(count: number): string {
  return `Field Notes, ${count} ${count === 1 ? "article" : "articles"}`;
}
