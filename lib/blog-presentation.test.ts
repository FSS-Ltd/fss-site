import assert from "node:assert/strict";
import test from "node:test";

import type { BlogPostMeta } from "@/lib/types/blog";
import {
  buildEditionMap,
  ART_NODE_RADIUS,
  buildRouteArt,
  routeAnchors,
  pickRelatedPosts,
  wrapLabel,
  type MapCell,
  type MapLayout,
  editionLabel,
  extractHeadings,
  formatEditorialDate,
  latestUpdate,
  selectLeadStory,
  shouldShowContents,
  slugifyHeading,
} from "@/lib/blog-presentation";

function post(overrides: Partial<BlogPostMeta>): BlogPostMeta {
  return {
    slug: "a",
    title: "A",
    excerpt: "e",
    publishDate: "2026-01-01",
    modifiedDate: "2026-01-01",
    author: "FSS",
    category: "Custom Software",
    tags: ["x"],
    coverImage: "/c.svg",
    seoTitle: "s",
    seoDescription: "d",
    featured: false,
    indexable: true,
    readingMinutes: 3,
    ...overrides,
  };
}

test("slugifyHeading makes stable anchor ids", () => {
  assert.equal(
    slugifyHeading("What problem should we document first?"),
    "what-problem-should-we-document-first",
  );
  assert.equal(slugifyHeading("  Café & AI -- costs  "), "cafe-ai-costs");
});

test("extractHeadings reads h2s only, strips inline Markdown and skips code fences", () => {
  const body = [
    "Intro paragraph.",
    "## Start with [one journey](/blog/x)",
    "### Not an h2",
    "```md",
    "## Inside a fence",
    "```",
    "## Use `code` and **bold**",
    "## Closing ##",
  ].join("\n");

  assert.deepEqual(extractHeadings(body), [
    { id: "start-with-one-journey", text: "Start with one journey" },
    { id: "use-code-and-bold", text: "Use code and bold" },
    { id: "closing", text: "Closing" },
  ]);
  assert.deepEqual(extractHeadings("No headings at all."), []);
});

test("contents appear only for three or more sections", () => {
  const two = extractHeadings("## One\n## Two");
  assert.equal(shouldShowContents(two), false);
  assert.equal(shouldShowContents(extractHeadings("## One\n## Two\n## Three")), true);
});

test("selectLeadStory prefers the newest featured post, else the newest", () => {
  const newest = post({ slug: "newest", publishDate: "2026-05-01" });
  const featured = post({ slug: "featured", featured: true, publishDate: "2026-04-01" });
  const older = post({ slug: "older", featured: true, publishDate: "2026-03-01" });

  const picked = selectLeadStory([newest, featured, older]);
  assert.equal(picked.lead?.slug, "featured");
  assert.deepEqual(picked.rest.map((p) => p.slug), ["newest", "older"]);

  assert.equal(selectLeadStory([newest]).lead?.slug, "newest");
  assert.deepEqual(selectLeadStory([newest]).rest, []);
  assert.equal(selectLeadStory([]).lead, undefined);
});

test("dates render in British form regardless of time zone", () => {
  assert.equal(formatEditorialDate("2026-04-02"), "2 April 2026");
  assert.equal(
    latestUpdate([
      post({ modifiedDate: "2026-04-02" }),
      post({ modifiedDate: "2026-09-04" }),
    ]),
    "2026-09-04",
  );
  assert.equal(latestUpdate([]), undefined);
});

const mk = (slug: string, publishDate: string, category: string, tags: string[] = [], featured = false) =>
  ({ slug, title: slug, publishDate, category, tags, featured }) as BlogPostMeta;

const SEVEN = [
  mk("church", "2026-09-04", "Software decisions", ["Charities", "Church software", "Custom Software"], true),
  mk("dash", "2026-04-13", "Dashboard", ["Custom Software", "UK", "Charities"]),
  mk("portal", "2026-04-11", "Portal", ["Custom Software", "UK", "Charities"]),
  mk("custom", "2026-04-04", "Custom Software", ["Custom Software", "UK", "Charities"]),
  mk("bespoke", "2026-04-02", "Bespoke", ["Custom Software", "UK", "Charities"]),
  mk("sdk", "2026-03-20", "Implementation", ["SDK"]),
  mk("pipe", "2026-03-11", "Growth", ["Pipeline"]),
];

function overlaps(a: MapCell, b: MapCell) {
  return (
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

test("edition map is deterministic whatever order the posts arrive in", () => {
  const map = buildEditionMap(SEVEN);
  assert.deepEqual(map, buildEditionMap([...SEVEN].reverse()));
  assert.equal(map?.lead, "church");
  assert.deepEqual(map?.order, ["church", "dash", "portal", "custom", "bespoke", "sdk", "pipe"]);
});

test("edition map cells never overlap and stay inside the grid, wide and mid", () => {
  for (const count of [1, 2, 3, 4, 5, 6, 7, 9]) {
    const posts = SEVEN.slice(0, 1).concat(
      Array.from({ length: count - 1 }, (_, i) => mk(`p${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`, "X")),
    );
    const map = buildEditionMap(posts);
    assert.ok(map);
    for (const name of ["wide", "mid"] as const) {
      const layout: MapLayout = map.layouts[name];
      const { cols, rows, cells } = layout;
      assert.equal(cells.length, count);
      cells.forEach((cell, i) => {
        assert.ok(cell.col >= 0 && cell.col + cell.colSpan <= cols, `${name} ${count} cols`);
        assert.ok(cell.row >= 0 && cell.row + cell.rowSpan <= rows, `${name} ${count} rows`);
        assert.ok(cell.x > 0 && cell.x < 1 && cell.y > 0 && cell.y < 1);
        cells.slice(i + 1).forEach((other) => assert.ok(!overlaps(cell, other), `${name} ${count} overlap`));
      });
      const lead = cells[0];
      for (const other of cells.slice(1)) {
        assert.ok(lead.colSpan * lead.rowSpan > other.colSpan * other.rowSpan, `${name} lead is largest`);
      }
    }
  }
});

test("edition map edges come only from shared section or tags; the route runs lead then newest", () => {
  const map = buildEditionMap(SEVEN)!;
  const bySlug = new Map(SEVEN.map((p) => [p.slug, p]));
  for (const edge of map.related) {
    const a = bySlug.get(edge.from)!;
    const b = bySlug.get(edge.to)!;
    assert.ok(a.category === b.category || a.tags.some((t) => b.tags.includes(t)), `${edge.from}-${edge.to}`);
    assert.ok(a.publishDate <= b.publishDate);
  }
  assert.deepEqual(
    map.related.map((e) => `${e.from}-${e.to}`),
    ["bespoke-custom", "custom-portal", "portal-dash", "dash-church"],
  );
  assert.deepEqual(map.route, ["church", "dash", "portal", "custom"]);
});

test("edition map handles no posts and one post; label counts from data", () => {
  assert.equal(buildEditionMap([]), undefined);
  const one = buildEditionMap([mk("x", "2026-01-01", "A")])!;
  assert.deepEqual(one.route, ["x"]);
  assert.equal(one.layouts.wide.cells[0].colSpan, 13);
  assert.equal(editionLabel(7), "Field Notes, 7 articles");
  assert.equal(editionLabel(1), "Field Notes, 1 article");
});

test("related posts vary per post: shared topics, then nearest date, never itself", () => {
  const pairs = SEVEN.map((p) => pickRelatedPosts(p, SEVEN).map((r) => r.slug).join(","));
  assert.ok(pairs.every((pair, i) => !pair.split(",").includes(SEVEN[i].slug)));
  assert.equal(new Set(pairs).size, SEVEN.length);
  assert.equal(pickRelatedPosts(SEVEN[3], SEVEN).map((r) => r.slug).join(), "bespoke,portal");
});

test("route art labels every heading, wraps long labels and scales per mode", () => {
  assert.deepEqual(wrapLabel("What should you define before commissioning a dashboard?", 26, 3), [
    "What should you define",
    "before commissioning a",
    "dashboard",
  ]);
  assert.ok(wrapLabel("a ".repeat(80), 10, 2).at(-1)?.endsWith("..."));
  const wide = buildRouteArt(["One", "Two", "Three", "Four", "Five"], "wide");
  assert.equal(wide.nodes.length, 5);
  assert.ok(wide.nodes.every((n) => n.x > 0 && n.x < wide.width && n.y > 0 && n.y < wide.height));
  assert.equal(wide.nodes[4].x, wide.nodes[3].x);
  const tall = buildRouteArt(["One", "Two", "Three"], "tall");
  assert.equal(tall.height, 228);
  assert.equal(buildRouteArt(Array(20).fill("x"), "wide").nodes.length, 8);
});

test("route anchors meet the facing edges of the two blocks", () => {
  const map = buildEditionMap(SEVEN)!;
  const wide = map.layouts.wide;
  const cell = (slug: string) => wide.cells.find((c) => c.slug === slug)!;
  const lead = cell("church");
  const first = cell("dash");
  const a = routeAnchors(lead, first, wide);
  assert.equal(a.x1, (lead.col + lead.colSpan) / wide.cols);
  assert.equal(a.x2, first.col / wide.cols);
  const mid = map.layouts.mid;
  const m = routeAnchors(mid.cells[0], mid.cells.find((c) => c.slug === "dash")!, mid);
  assert.equal(m.y1, (mid.cells[0].row + mid.cells[0].rowSpan) / mid.rows);
});

type Seg = { x1: number; y1: number; x2: number; y2: number };

/** Does an axis-aligned segment pass within `pad` of the rect? */
function crosses(seg: Seg, r: { x: number; y: number; w: number; h: number }, pad = 4) {
  const [x0, x1] = [Math.min(seg.x1, seg.x2), Math.max(seg.x1, seg.x2)];
  const [y0, y1] = [Math.min(seg.y1, seg.y2), Math.max(seg.y1, seg.y2)];
  return x1 > r.x - pad && x0 < r.x + r.w + pad && y1 > r.y - pad && y0 < r.y + r.h + pad;
}

test("hero routes start and end on node edges and never cross a label box, 3 to 6 headings", () => {
  const long = (i: number) =>
    `What should a charity ask about question number ${i} before it signs anything at all`;
  for (const mode of ["wide", "tall"] as const) {
    for (let n = 3; n <= 6; n++) {
      const art = buildRouteArt(Array.from({ length: n }, (_, i) => long(i)), mode);
      assert.equal(art.legs.length, n - 1, `${mode} ${n} legs`);
      art.legs.forEach((leg, i) => {
        const a = art.nodes[i];
        const b = art.nodes[i + 1];
        const gap = (p: { x: number; y: number }, node: { x: number; y: number }) =>
          Math.hypot(p.x - node.x, p.y - node.y);
        assert.equal(gap(leg[0], a), ART_NODE_RADIUS, `${mode} ${n} leg ${i} start`);
        assert.equal(gap(leg[leg.length - 1], b), ART_NODE_RADIUS, `${mode} ${n} leg ${i} end`);
        for (let s = 1; s < leg.length; s++) {
          const seg = { x1: leg[s - 1].x, y1: leg[s - 1].y, x2: leg[s].x, y2: leg[s].y };
          art.nodes.forEach((node, k) =>
            assert.ok(!crosses(seg, node.box), `${mode} ${n}: leg ${i} crosses label ${k}`),
          );
        }
      });
    }
  }
});

test("edition map edges carry the shared section, else the first shared topic", () => {
  const map = buildEditionMap(SEVEN)!;
  const label = (from: string, to: string) =>
    map.related.find((e) => e.from === from && e.to === to)?.label;
  assert.equal(label("dash", "church"), "Custom Software");
  assert.ok(map.related.every((e) => e.label.length > 0));
  const same = buildEditionMap([mk("a", "2026-01-01", "Growth"), mk("b", "2026-01-02", "Growth", ["z"])])!;
  assert.equal(same.related[0].label, "Growth");
});

test("each node column ends flush with the grid, so no column leaves a gap at its foot", () => {
  for (const count of [3, 4, 5, 6, 7, 8]) {
    const posts = [mk("lead", "2026-09-01", "X", [], true)].concat(
      Array.from({ length: count - 1 }, (_, i) => mk(`p${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`, "X")),
    );
    const map = buildEditionMap(posts)!;
    for (const name of ["wide", "mid"] as const) {
      const { rows, cells } = map.layouts[name];
      const cols = new Map<number, number>();
      cells.slice(1).forEach((c) => cols.set(c.col, Math.max(cols.get(c.col) ?? 0, c.row + c.rowSpan)));
      for (const [col, end] of cols) assert.equal(end, rows, `${name} ${count} col ${col}`);
    }
  }
});
