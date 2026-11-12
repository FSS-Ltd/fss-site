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

/** Routes for one layout, drawn under the nodes between cell centres. Grey
 *  lines are real relations (shared section or tags); the rust route runs
 *  from the lead through the newest articles and is drawn over them. */
function Routes({ map, layout }: { map: EditionMapData; layout: MapLayoutName }) {
  const cells = new Map(
    map.layouts[layout].cells.map((cell) => [cell.slug, cell]),
  );
  const segments = map.route.slice(1).map((slug, i) => [map.route[i], slug]);
  const onRoute = new Set(segments.map(([a, b]) => `${a}>${b}`));
  const line = (a: string, b: string, className: string) => {
    const from = cells.get(a);
    const to = cells.get(b);
    if (!from || !to) return null;
    const at = routeAnchors(from, to, map.layouts[layout]);
    return (
      <line
        key={`${a}>${b}`}
        x1={pct(at.x1)}
        y1={pct(at.y1)}
        x2={pct(at.x2)}
        y2={pct(at.y2)}
        vectorEffect="non-scaling-stroke"
        className={className}
      />
    );
  };
  return (
    <div
      className={`${styles.mapRoutes} ${layout === "wide" ? styles.mapWide : styles.mapMid}`}
      aria-hidden="true"
    >
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
      {map.related
        .filter((edge) => !onRoute.has(`${edge.from}>${edge.to}`) && !onRoute.has(`${edge.to}>${edge.from}`))
        .map((edge) => line(edge.from, edge.to, styles.mapEdge))}
      {segments.map(([a, b]) => line(a, b, styles.mapRoute))}
    </svg>
    </div>
  );
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
          share a section or topic.
        </p>
      </div>
      <div className={styles.mapBody} style={gridVars as React.CSSProperties}>
        <DrawIn className={styles.mapLayer}>
          {LAYOUTS.map((layout) => (
            <Routes key={layout} map={map} layout={layout} />
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
                style={vars as React.CSSProperties}
              >
                <CoverTransition slug={slug}>
                  <Link
                    href={`/blog/${slug}`}
                    className={styles.mapLink}
                    aria-label={post.title}
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
                    ) : null}
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
