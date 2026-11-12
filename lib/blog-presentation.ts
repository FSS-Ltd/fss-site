import type { BlogPostMeta } from "@/lib/types/blog";

export type ArticleHeading = { id: string; text: string };

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

export type MapCell = {
  slug: string;
  /** Grid placement, zero-based, in whole columns and rows. */
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
  /** Cell centre as a share of the map, 0 to 1 on both axes. */
  x: number;
  y: number;
};

export type MapLayout = { cols: number; rows: number; cells: MapCell[] };
export type MapLayoutName = "wide" | "mid";
export type MapEdge = { from: string; to: string };

export type EditionMap = {
  lead: string;
  /** Lead first, then every other article newest first: the phone rail order. */
  order: string[];
  /** Real relations only: shared section or shared tags. Older article first. */
  related: MapEdge[];
  /** The rust route: the lead, then the newest other articles. */
  route: string[];
  layouts: Record<MapLayoutName, MapLayout>;
};

/** Articles on the rust route after the lead. */
export const ROUTE_STOPS = 3;
const NODE_COLS = 3;
const NODE_ROWS = 2;
const LEAD_MIN_ROWS = 4;
const MID_LEAD_ROWS = 3;

/** Wide: lead column, then two node columns split by a one-column gutter for
 *  routes. Mid: the lead on top, the same two node columns below it. */
const MAP_SHAPES: Record<
  MapLayoutName,
  { cols: number; leadCols: number; starts: [number, number]; leadRows: number | null }
> = {
  wide: { cols: 13, leadCols: 5, starts: [6, 10], leadRows: null },
  mid: { cols: 7, leadCols: 7, starts: [0, 4], leadRows: MID_LEAD_ROWS },
};

function relationScore(a: BlogPostMeta, b: BlogPostMeta): number {
  const shared = (a.tags ?? []).filter((tag) => b.tags?.includes(tag)).length;
  return shared + (a.category === b.category ? 2 : 0);
}

function byDateAsc(a: BlogPostMeta, b: BlogPostMeta): number {
  return a.publishDate.localeCompare(b.publishDate) || a.slug.localeCompare(b.slug);
}

/**
 * The edition as a map. Every article is a node placed on a grid, so cells
 * cannot overlap by construction; the lead is the largest cell. Edges come
 * only from the data: each article joins the earlier one it shares most with
 * (same section counts double, each shared tag once; ties go to the newer).
 * Articles that share nothing stay unjoined. Same posts in, same map out,
 * whatever order they arrive in.
 */
export function buildEditionMap(posts: BlogPostMeta[]): EditionMap | undefined {
  const newestFirst = [...posts].sort((a, b) => byDateAsc(b, a));
  const { lead } = selectLeadStory(newestFirst);
  if (!lead) return undefined;
  const others = newestFirst.filter((post) => post !== lead);

  const related: MapEdge[] = [];
  const oldestFirst = [...posts].sort(byDateAsc);
  oldestFirst.forEach((post, index) => {
    let best: BlogPostMeta | undefined;
    let bestScore = 0;
    for (const earlier of oldestFirst.slice(0, index)) {
      const score = relationScore(post, earlier);
      if (score > 0 && score >= bestScore) {
        best = earlier;
        bestScore = score;
      }
    }
    if (best) related.push({ from: best.slug, to: post.slug });
  });

  const layouts = {} as Record<MapLayoutName, MapLayout>;
  for (const name of Object.keys(MAP_SHAPES) as MapLayoutName[]) {
    const shape = MAP_SHAPES[name];
    const top = shape.leadRows ?? 0;
    const cells: MapCell[] = [];
    const place = (slug: string, col: number, colSpan: number, row: number, rowSpan: number) =>
      cells.push({ slug, col, colSpan, row, rowSpan, x: 0, y: 0 });

    others.forEach((post, index) => {
      // Two node columns, the second dropped one row: the route zigzags.
      const side = index % 2;
      const row = top + Math.floor(index / 2) * NODE_ROWS + side;
      place(post.slug, shape.starts[side], NODE_COLS, row, NODE_ROWS);
    });
    const used = cells.reduce((max, cell) => Math.max(max, cell.row + cell.rowSpan), top);
    const rows = shape.leadRows ? used : Math.max(used, LEAD_MIN_ROWS);
    cells.unshift({
      slug: lead.slug,
      col: 0,
      colSpan: others.length ? shape.leadCols : shape.cols,
      row: 0,
      rowSpan: shape.leadRows ?? rows,
      x: 0,
      y: 0,
    });
    layouts[name] = {
      cols: shape.cols,
      rows,
      cells: cells.map((cell) => ({
        ...cell,
        x: (cell.col + cell.colSpan / 2) / shape.cols,
        y: (cell.row + cell.rowSpan / 2) / rows,
      })),
    };
  }

  return {
    lead: lead.slug,
    order: [lead.slug, ...others.map((post) => post.slug)],
    related,
    route: [lead.slug, ...others.slice(0, ROUTE_STOPS).map((post) => post.slug)],
    layouts,
  };
}

/**
 * Where a route leaves one cell and enters the other, as shares of the map:
 * the facing edge midpoints, so lines meet the blocks where they touch the
 * gutter instead of disappearing under them.
 */
export function routeAnchors(
  from: MapCell,
  to: MapCell,
  layout: { cols: number; rows: number },
): { x1: number; y1: number; x2: number; y2: number } {
  const { cols, rows } = layout;
  const right = (c: MapCell) => (c.col + c.colSpan) / cols;
  const left = (c: MapCell) => c.col / cols;
  const bottom = (c: MapCell) => (c.row + c.rowSpan) / rows;
  const top = (c: MapCell) => c.row / rows;
  if (to.col >= from.col + from.colSpan)
    return { x1: right(from), y1: from.y, x2: left(to), y2: to.y };
  if (from.col >= to.col + to.colSpan)
    return { x1: left(from), y1: from.y, x2: right(to), y2: to.y };
  if (to.row >= from.row + from.rowSpan)
    return { x1: from.x, y1: bottom(from), x2: to.x, y2: top(to) };
  return { x1: from.x, y1: top(from), x2: to.x, y2: bottom(to) };
}

/**
 * Other articles for the end of a post: most in common first (section counts
 * double, each shared tag once), then the closest publishing date, then the
 * newest. Never the post itself, so the pair differs from post to post.
 */
export function pickRelatedPosts(
  post: BlogPostMeta,
  all: BlogPostMeta[],
  limit = 2,
): BlogPostMeta[] {
  const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return all
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      candidate,
      score: relationScore(post, candidate),
      gap: Math.abs(day(candidate.publishDate) - day(post.publishDate)),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.gap - b.gap ||
        byDateAsc(b.candidate, a.candidate),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export type RouteArtNode = {
  label: string[];
  x: number;
  y: number;
  /** The node the route starts from (the post itself, in the fallback). */
  primary: boolean;
};

export type RouteArt = {
  width: number;
  height: number;
  nodes: RouteArtNode[];
};

export const ART_MAX_NODES = 8;

/** A label cut to at most `lines` lines of about `max` characters each. */
export function wrapLabel(text: string, max = 26, lines = 3): string[] {
  const words = text.replace(/[?.:;]+$/, "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  let cut = false;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max || !line) {
      line = next;
      continue;
    }
    out.push(line);
    line = word;
    if (out.length === lines) {
      cut = true;
      line = "";
      break;
    }
  }
  if (line) out.push(line);
  if (cut && out.length) out[out.length - 1] = `${out[out.length - 1].replace(/[,;:]$/, "")}...`;
  return out.slice(0, lines);
}

/**
 * Hero art for a post: one labelled node per label on a single route. "wide"
 * snakes across up to four columns; "tall" is one column, the phone rail.
 * Positions are in the SVG's own units, so the art scales as one picture.
 */
export function buildRouteArt(
  labels: string[],
  mode: "wide" | "tall",
): RouteArt {
  const shown = labels.slice(0, ART_MAX_NODES);
  if (mode === "tall") {
    const step = 76;
    return {
      width: 340,
      height: Math.max(shown.length, 1) * step,
      nodes: shown.map((label, index) => ({
        label: wrapLabel(label, 24, 2),
        x: 18,
        y: step / 2 + index * step,
        primary: index === 0,
      })),
    };
  }
  const cols = Math.min(Math.max(shown.length, 1), 4);
  const rows = Math.ceil(Math.max(shown.length, 1) / cols);
  const width = 1120;
  const cell = width / cols;
  const rowStep = 150;
  return {
    width,
    height: rows * rowStep,
    nodes: shown.map((label, index) => {
      const row = Math.floor(index / cols);
      const inRow = index % cols;
      // Boustrophedon: odd rows run right to left, so the route never jumps back.
      const col = row % 2 ? cols - 1 - inRow : inRow;
      return {
        label: wrapLabel(label, 28, 3),
        x: col * cell + 12,
        y: row * rowStep + 44,
        primary: index === 0,
      };
    }),
  };
}

/** "Field Notes, 7 articles": the count comes from the posts, never typed. */
export function editionLabel(count: number): string {
  return `Field Notes, ${count} ${count === 1 ? "article" : "articles"}`;
}
