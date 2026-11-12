import Link from "next/link";

import type { BlogPostMeta } from "@/lib/types/blog";
import {
  type EditionMap as EditionMapData,
  type MapLayoutName,
  editionLabel,
  routeAnchors,
} from "@/lib/blog-presentation";
import { DrawIn } from "@/components/blog/draw-in";
import { CoverTransition } from "@/components/blog/cover-transition";
import { PostMeta } from "@/components/blog/blog-post-card";
import styles from "@/components/blog/blog.module.css";

const LAYOUTS: MapLayoutName[] = ["wide", "mid"];
const pct = (value: number) => (value * 100).toFixed(2);

type MapLine = { a: string; b: string; kind: "route" | "edge"; label?: string };

/** Every drawn line: the rust route, then the grey relations that are not on
 *  it. A route hop that is also a relation carries that relation's label. */
function mapLines(map: EditionMapData): MapLine[] {
  const key = (a: string, b: string) => [a, b].sort().join(">");
  const labels = new Map(map.related.map((edge) => [key(edge.from, edge.to), edge.label]));
  const hops = map.route.slice(1).map((slug, i) => [map.route[i], slug]);
  const onRoute = new Set(hops.map(([a, b]) => key(a, b)));
  return [
    ...map.related
      .filter((edge) => !onRoute.has(key(edge.from, edge.to)))
      .map((edge): MapLine => ({ a: edge.from, b: edge.to, kind: "edge", label: edge.label })),
    ...hops.map(([a, b]): MapLine => ({ a, b, kind: "route", label: labels.get(key(a, b)) })),
  ];
}

/** Routes for one layout, drawn under the nodes between cell edges. Grey
 *  lines are real relations (shared section or tags) and carry a label naming
 *  what the two articles share; the rust route runs from the lead through the
 *  newest articles and is drawn over them. Each line and label lists the nodes
 *  it touches in data-e, which the hover rules below read. */
function Routes({
  map,
  lines,
  layout,
}: {
  map: EditionMapData;
  lines: MapLine[];
  layout: MapLayoutName;
}) {
  const cells = new Map(
    map.layouts[layout].cells.map((cell) => [cell.slug, cell]),
  );
  const ends = (line: MapLine) => `${map.order.indexOf(line.a)} ${map.order.indexOf(line.b)}`;
  const placed = lines.flatMap((line) => {
    const from = cells.get(line.a);
    const to = cells.get(line.b);
    if (!from || !to) return [];
    return [{ line, from, to, at: routeAnchors(from, to, map.layouts[layout]) }];
  });
  return (
    <div
      className={`${styles.mapRoutes} ${layout === "wide" ? styles.mapWide : styles.mapMid}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        {placed.map(({ line, at }) => (
          <line
            key={`${line.a}>${line.b}`}
            x1={pct(at.x1)}
            y1={pct(at.y1)}
            x2={pct(at.x2)}
            y2={pct(at.y2)}
            vectorEffect="non-scaling-stroke"
            className={line.kind === "route" ? styles.mapRoute : styles.mapEdge}
            data-e={ends(line)}
          />
        ))}
      </svg>
      {placed.map(({ line, from, to, at }) => {
        // Only lines that cross a gutter have room for a label; a stacked pair
        // would put it under the cards.
        const sideBySide =
          to.col >= from.col + from.colSpan || from.col >= to.col + to.colSpan;
        if (!line.label || !sideBySide) return null;
        return (
          <span
            key={`${line.a}>${line.b}`}
            className={styles.mapEdgeLabel}
            style={{
              left: `${pct((at.x1 + at.x2) / 2)}%`,
              top: `${pct((at.y1 + at.y2) / 2)}%`,
            }}
            data-e={ends(line)}
          >
            {line.label}
          </span>
        );
      })}
    </div>
  );
}

/** Hover or keyboard focus on a node: the nodes, lines and labels joined to it
 *  stay at full strength (lines and labels turn rust) and the rest drop to 40%.
 *  CSS only. The rules are generated from the map so they follow the data;
 *  indices and class names are the only interpolated values. */
function emphasisCss(map: EditionMapData, lines: MapLine[]): string {
  const { mapBody, mapNode, mapLink, mapEdge, mapRoute, mapEdgeLabel } = styles;
  return map.order
    .map((slug, k) => {
      const joined = new Set(
        lines.flatMap((l) => (l.a === slug ? [l.b] : l.b === slug ? [l.a] : [])),
      );
      const withK = [...joined].map((s) => map.order.indexOf(s));
      const hot = `.${mapBody}:has(.${mapNode}[data-n="${k}"] .${mapLink}:is(:hover,:focus-visible))`;
      const joinedNodes = withK.map((n) => `[data-n="${n}"]`).join(",");
      const keep = `[data-n="${k}"]${joinedNodes ? `,${joinedNodes}` : ""}`;
      return [
        `${hot} .${mapNode}:not(${keep}){opacity:.4}`,
        `${hot} :is(.${mapEdge},.${mapRoute},.${mapEdgeLabel}):not([data-e~="${k}"]){opacity:.4}`,
        `${hot} .${mapEdge}[data-e~="${k}"]{stroke:var(--brand-primary);stroke-opacity:1;stroke-width:2.5}`,
        `${hot} .${mapRoute}[data-e~="${k}"]{stroke-width:4}`,
        `${hot} .${mapEdgeLabel}[data-e~="${k}"]{color:var(--brand-primary)}`,
      ].join("\n");
    })
    .join("\n");
}

/** The blog index as one labelled route map. Every article is a node block
 *  (category, title, date, read time) and the whole block is its link. The
 *  lead is the largest node. Placement is a grid from buildEditionMap, so
 *  nodes cannot overlap; on phones the same nodes stack as a vertical rail,
 *  like the article contents. */
export function EditionMap({
  posts,
  map,
}: {
  posts: BlogPostMeta[];
  map: EditionMapData;
}) {
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const cellsOf = (name: MapLayoutName) =>
    new Map(map.layouts[name].cells.map((cell) => [cell.slug, cell]));
  const wide = cellsOf("wide");
  const mid = cellsOf("mid");
  const routeLast = map.route[map.route.length - 1];
  const lines = mapLines(map);

  const gridVars: Record<string, number> = {
    "--w-cols": map.layouts.wide.cols,
    "--w-rows": map.layouts.wide.rows,
    "--m-cols": map.layouts.mid.cols,
    "--m-rows": map.layouts.mid.rows,
  };

  return (
    <section
      className={styles.map}
      aria-labelledby="edition-map"
      data-motion-reveal="up"
    >
      <div className={styles.sectionHead}>
        <h2 id="edition-map" className={styles.sectionTitle}>
          {editionLabel(posts.length)}
        </h2>
        <p className={styles.mapKey}>
          <span className={styles.mapKeyRoute}>Rust route</span> runs from the
          lead through the newest. <span>Grey lines</span> join articles that
          share a section or topic, and each label names it.
        </p>
      </div>
      <div className={styles.mapBody} style={gridVars as React.CSSProperties}>
        <style dangerouslySetInnerHTML={{ __html: emphasisCss(map, lines) }} />
        <DrawIn className={styles.mapLayer}>
          {LAYOUTS.map((layout) => (
            <Routes key={layout} map={map} lines={lines} layout={layout} />
          ))}
        </DrawIn>
        <ol className={styles.mapNodes}>
          {map.order.map((slug, index) => {
            const post = bySlug.get(slug);
            const w = wide.get(slug);
            const m = mid.get(slug);
            if (!post || !w || !m) return null;
            const lead = slug === map.lead;
            const onRoute = map.route.includes(slug);
            const vars: Record<string, number> = {
              "--i": index,
              "--w-col": w.col + 1,
              "--w-span": w.colSpan,
              "--w-row": w.row + 1,
              "--w-rspan": w.rowSpan,
              "--m-col": m.col + 1,
              "--m-span": m.colSpan,
              "--m-row": m.row + 1,
              "--m-rspan": m.rowSpan,
            };
            return (
              <li
                key={slug}
                className={`${styles.mapNode} ${lead ? styles.mapLead : ""}`}
                data-route={onRoute ? "" : undefined}
                data-route-next={onRoute && slug !== routeLast ? "" : undefined}
                data-n={index}
                data-tall-w={w.rowSpan > 2 ? "" : undefined}
                data-tall-m={m.rowSpan > 2 ? "" : undefined}
                style={vars as React.CSSProperties}
              >
                <CoverTransition slug={slug}>
                  <Link
                    href={`/blog/${slug}`}
                    className={styles.mapLink}
                    data-lift-light
                  >
                    <span className={styles.mapDot} aria-hidden="true" />
                    <span className={styles.mapKicker}>
                      {lead ? `Lead story / ${post.category}` : post.category}
                    </span>
                    <span className={styles.mapTitle}>
                      <span className={styles.grow}>{post.title}</span>
                    </span>
                    {lead ? (
                      <span className={styles.mapStandfirst}>{post.excerpt}</span>
                    ) : (
                      /* Shown only when the grid stretches this node taller than
                         the usual two rows, so the extra height carries text. */
                      <span className={styles.mapExcerpt}>{post.excerpt}</span>
                    )}
                    <PostMeta post={post} withAuthor={lead} />
                  </Link>
                </CoverTransition>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
