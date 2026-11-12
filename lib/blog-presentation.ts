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

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decodes the entities MDX renders as characters, so ids match the rendered text. */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([\da-f]+)|(\w+));/gi, (whole, dec, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? whole;
    const code = dec ? Number(dec) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/**
 * Hands out heading ids for one document: `s-` keeps them clear of the layout's
 * fixed ids (read-next, article-contents ...), and repeats get -2, -3 by
 * occurrence. extractHeadings and the rendered h2 each use a fresh allocator,
 * so both walk the same headings in the same order and agree.
 */
export function createHeadingIds(): (text: string) => string {
  const used = new Set<string>();
  return (text) => {
    const base = `s-${slugifyHeading(text)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
}

/** Plain text of a Markdown heading: links keep their label, emphasis and code marks go. */
function stripInlineMarkdown(text: string): string {
  return decodeEntities(text)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

/** The article's h2s, in order, ignoring anything inside fenced code. */
export function extractHeadings(body: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const nextId = createHeadingIds();
  let inFence = false;

  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    const match = inFence ? null : /^## (.+)$/.exec(line.trim());
    if (!match) continue;
    const text = stripInlineMarkdown(match[1]);
    if (text && slugifyHeading(text)) headings.push({ id: nextId(text), text });
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

/** Midnight UTC of an ISO date's day, or NaN when missing or invalid. */
function dayMs(isoDate: string | undefined): number {
  return Date.parse(`${(isoDate ?? "").slice(0, 10)}T00:00:00Z`);
}

/** "2026-04-02" as "2 April 2026", independent of the server's time zone. "" when the date is missing or invalid. */
export function formatEditorialDate(isoDate: string | undefined): string {
  const ms = dayMs(isoDate);
  return Number.isNaN(ms) ? "" : dateFormatter.format(ms);
}

/** Newest modified or published date across the posts, for the masthead dateline. */
export function latestUpdate(posts: BlogPostMeta[]): string | undefined {
  return posts
    .map((post) => post.modifiedDate ?? post.publishDate)
    .filter((date) => !Number.isNaN(dayMs(date)))
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
/** `label` is the shared section, or else the first shared topic. */
export type MapEdge = { from: string; to: string; label: string };

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

function relationLabel(a: BlogPostMeta, b: BlogPostMeta): string {
  if (a.category === b.category) return a.category;
  return (a.tags ?? []).find((tag) => b.tags?.includes(tag)) ?? "";
}

function byDateAsc(a: BlogPostMeta, b: BlogPostMeta): number {
  return (a.publishDate ?? "").localeCompare(b.publishDate ?? "") || a.slug.localeCompare(b.slug);
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
    if (best) related.push({ from: best.slug, to: post.slug, label: relationLabel(best, post) });
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
    // Each column's last node stretches to the foot of the grid, so no column
    // ends in empty space under its last card.
    for (const col of shape.starts) {
      const last = cells
        .filter((cell) => cell.col === col)
        .reduce<MapCell | undefined>((a, c) => (!a || c.row > a.row ? c : a), undefined);
      if (last) last.rowSpan = rows - last.row;
    }
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

export type EdgeLabelCandidate = {
  id: string;
  label: string;
  /** The gutter the line crosses, e.g. its two x anchors; same gutter, same value. */
  gutter: string;
  /** Vertical midpoint of the line, to find the middle one. */
  y: number;
};

/**
 * Which lines keep their label. Several lines in one gutter that name the same
 * thing would repeat it, so the label is shown once, on the middle line (by
 * height; the upper one when the count is even). Returns the ids that keep it.
 */
export function visibleEdgeLabels(candidates: EdgeLabelCandidate[]): Set<string> {
  const groups = new Map<string, EdgeLabelCandidate[]>();
  for (const c of candidates) {
    if (!c.label) continue;
    const key = `${c.gutter}|${c.label}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return new Set(
    [...groups.values()].map((g) => {
      const sorted = [...g].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
      return sorted[Math.floor((sorted.length - 1) / 2)].id;
    }),
  );
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

/** Older articles kept online for their links but never promoted as related reading. */
const NOT_PROMOTED = ["sdk-integration-playbook", "technical-content-lead-pipeline"];

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
  return all
    .filter(
      (candidate) =>
        candidate.slug !== post.slug && !NOT_PROMOTED.includes(candidate.slug),
    )
    .map((candidate) => ({
      candidate,
      score: relationScore(post, candidate),
      // An invalid date has no gap to speak of: it sorts after every dated candidate.
      gap: Math.abs(dayMs(candidate.publishDate) - dayMs(post.publishDate)) || 0,
      dated: !Number.isNaN(dayMs(candidate.publishDate) - dayMs(post.publishDate)),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.dated) - Number(a.dated) ||
        a.gap - b.gap ||
        byDateAsc(b.candidate, a.candidate),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type RouteArtNode = {
  label: string[];
  x: number;
  y: number;
  /** The node the route starts from (the post itself, in the fallback). */
  primary: boolean;
  /** Baseline origins of the number/kicker line and the first label line. */
  kicker: Point;
  text: Point;
  /** Where the kicker (up to "THIS ARTICLE") and label sit, so routes keep clear. */
  box: Rect;
};

export type RouteArt = {
  /** The viewBox: the drawn content's bounds plus a small pad, so the card
   *  never has an empty side. Origin is the top-left of that box. */
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: RouteArtNode[];
  /** One polyline per hop, from the edge of one node to the edge of the next. */
  legs: Point[][];
};

export const ART_MAX_NODES = 8;
export const ART_NODE_RADIUS = 9;
const ART_LINE = 19;
const ART_CHAR_W = 9;
const ART_GUTTER = 16;

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

function artNode(
  label: string[],
  x: number,
  y: number,
  primary: boolean,
  below: boolean,
): RouteArtNode {
  const top = below ? y + 40 : y - ((label.length - 1) * ART_LINE) / 2;
  const lx = below ? x - 9 : x + 24;
  const kicker = { x: lx, y: top - 18 };
  const text = { x: lx, y: top + 5 };
  const w = Math.max(...label.map((line) => line.length), 12) * ART_CHAR_W;
  const bottom = text.y + (label.length - 1) * ART_LINE + 5;
  return {
    label,
    x,
    y,
    primary,
    kicker,
    text,
    box: { x: lx, y: kicker.y - 10, w, h: bottom - kicker.y + 10 },
  };
}

/**
 * Routes between the nodes. Each leg starts and ends on a node's edge. Along a
 * row or down the tall rail it is a straight line; where the wide snake turns
 * to the next row, the line leaves the node sideways and drops in a channel
 * outside every label, so it never crosses a label box.
 */
function artLegs(nodes: RouteArtNode[], cols: number | null): Point[][] {
  const r = ART_NODE_RADIUS;
  const legs: Point[][] = [];
  nodes.slice(1).forEach((b, i) => {
    const a = nodes[i];
    if (a.y === b.y) {
      const dir = Math.sign(b.x - a.x);
      legs.push([{ x: a.x + dir * r, y: a.y }, { x: b.x - dir * r, y: b.y }]);
    } else if (cols === null) {
      const dir = Math.sign(b.y - a.y);
      legs.push([{ x: a.x, y: a.y + dir * r }, { x: b.x, y: b.y - dir * r }]);
    } else {
      const side = Math.floor(i / cols) % 2 === 0 ? 1 : -1;
      const rows = nodes.filter((n) => n.y >= a.y && n.y <= b.y);
      const channel =
        side === 1
          ? Math.max(...rows.map((n) => n.box.x + n.box.w)) + ART_GUTTER
          : Math.min(...rows.map((n) => n.box.x)) - ART_GUTTER;
      legs.push([
        { x: a.x + side * r, y: a.y },
        { x: channel, y: a.y },
        { x: channel, y: b.y },
        { x: b.x + side * r, y: b.y },
      ]);
    }
  });
  return legs;
}

const ART_PAD = 8;

/** Bounds of everything drawn (dots, label boxes, route legs) plus a pad. */
function artBounds(nodes: RouteArtNode[], legs: Point[][]) {
  const r = ART_NODE_RADIUS;
  const xs = [
    ...nodes.flatMap((n) => [n.x - r, n.x + r, n.box.x, n.box.x + n.box.w]),
    ...legs.flat().map((p) => p.x),
  ];
  const ys = [
    ...nodes.flatMap((n) => [n.y - r, n.y + r, n.box.y, n.box.y + n.box.h]),
    ...legs.flat().map((p) => p.y),
  ];
  const x = Math.min(...xs) - ART_PAD;
  const y = Math.min(...ys) - ART_PAD;
  return {
    x,
    y,
    width: Math.max(...xs) + ART_PAD - x,
    height: Math.max(...ys) + ART_PAD - y,
  };
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
    const nodes = shown.map((label, index) =>
      artNode(wrapLabel(label, 24, 2), 18, step / 2 + index * step, index === 0, false),
    );
    const legs = artLegs(nodes, null);
    return { ...artBounds(nodes, legs), nodes, legs };
  }
  const cols = Math.min(Math.max(shown.length, 1), 4);
  const width = 1120;
  const rowStep = 150;
  const wrapped = shown.map((label) => wrapLabel(label, 28, 3));
  // Columns are spread so the last label ends at the right edge, not before it.
  const widest = Math.max(...wrapped.flatMap((lines) => lines.map((line) => line.length)), 12) * ART_CHAR_W;
  const cell = cols > 1 ? (width - 12 - widest) / (cols - 1) : 0;
  const nodes = wrapped.map((label, index) => {
    const row = Math.floor(index / cols);
    const inRow = index % cols;
    // Boustrophedon: odd rows run right to left, so the route never jumps back.
    const col = row % 2 ? cols - 1 - inRow : inRow;
    return artNode(label, col * cell + 12, row * rowStep + 44, index === 0, true);
  });
  const legs = artLegs(nodes, cols);
  return { ...artBounds(nodes, legs), nodes, legs };
}

/** "Field Notes, 7 articles": the count comes from the posts, never typed. */
export function editionLabel(count: number): string {
  return `Field Notes, ${count} ${count === 1 ? "article" : "articles"}`;
}
