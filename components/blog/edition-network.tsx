import Link from "next/link";

import type { EditionNetwork as Network } from "@/lib/blog-presentation";
import { editionLabel } from "@/lib/blog-presentation";
import styles from "@/components/blog/blog.module.css";
import { sectionCounter } from "@/components/ui/mesh-band";

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

/** The blog's stand-in for the shared mesh band: every article is a node,
 *  joined by thin routes, so the strip shows the edition as a connected system.
 *  The current article (post pages) is lit in rust with its routes. Nodes are
 *  HTML links positioned by percentage over an SVG of straight routes, so the
 *  hit areas keep their size at any width. data-mesh-band keeps the shared
 *  entrance cascade from globals.css. */
export function EditionNetwork({
  network,
  currentSlug,
  compact = false,
}: {
  network: Network;
  currentSlug?: string;
  compact?: boolean;
}) {
  const { nodes, routes } = network;
  if (!nodes.length) return null;
  const byslug = new Map(nodes.map((node) => [node.slug, node]));

  return (
    <nav
      data-mesh-band
      aria-label="Field Notes edition network"
      className={`${styles.net} ${compact ? styles.netCompact : ""}`}
      style={{ ["--d" as string]: "0.16s" }}
    >
      <p className={styles.netLabel}>
        <span aria-hidden="true">{sectionCounter("blog")}</span>
        <span>{editionLabel(nodes.length)}</span>
      </p>
      <div className={styles.netMap}>
        <svg
          className={styles.netRoutes}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {routes.map((route) => {
            const from = byslug.get(route.from);
            const to = byslug.get(route.to);
            if (!from || !to) return null;
            const lit = route.from === currentSlug || route.to === currentSlug;
            return (
              <line
                key={`${route.from}-${route.to}`}
                x1={from.x * 100}
                y1={from.y * 100}
                x2={to.x * 100}
                y2={to.y * 100}
                vectorEffect="non-scaling-stroke"
                className={[
                  styles.netRoute,
                  route.kind === "related" ? styles.netRouteRelated : "",
                  lit ? styles.netRouteLit : "",
                ].join(" ")}
              />
            );
          })}
        </svg>
        <ul className={styles.netNodes}>
          {nodes.map((node, index) => {
            const current = node.slug === currentSlug;
            const side = node.x < 0.33 ? "start" : node.x > 0.67 ? "end" : "mid";
            const tip = (
              <span className={styles.netTip} aria-hidden="true">
                {node.title}
              </span>
            );
            return (
              <li
                key={node.slug}
                className={styles.netNode}
                data-current={current ? "" : undefined}
                data-side={side}
                data-up={node.y > 0.5 ? "" : undefined}
                style={{
                  left: pct(node.x),
                  top: pct(node.y),
                  ["--i" as string]: index,
                }}
              >
                {current ? (
                  <span className={styles.netHit} aria-current="page">
                    <span className={styles.netDot} />
                    <span className={styles.srOnly}>{node.title} (this article)</span>
                  </span>
                ) : (
                  <Link
                    href={`/blog/${node.slug}`}
                    className={styles.netHit}
                    aria-label={node.title}
                  >
                    <span className={styles.netDot} />
                  </Link>
                )}
                {tip}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** A card's miniature of the network, with that article's node lit. */
export function NetworkGlyph({
  network,
  slug,
}: {
  network: Network;
  slug: string;
}) {
  if (!network.nodes.some((node) => node.slug === slug)) return null;
  const byslug = new Map(network.nodes.map((node) => [node.slug, node]));
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 100 40"
      aria-hidden="true"
      focusable="false"
    >
      {network.routes.map((route) => {
        const from = byslug.get(route.from);
        const to = byslug.get(route.to);
        if (!from || !to) return null;
        return (
          <line
            key={`${route.from}-${route.to}`}
            x1={from.x * 100}
            y1={from.y * 40}
            x2={to.x * 100}
            y2={to.y * 40}
            className={
              route.from === slug || route.to === slug
                ? styles.glyphRouteLit
                : styles.glyphRoute
            }
          />
        );
      })}
      {network.nodes.map((node) => (
        <circle
          key={node.slug}
          cx={node.x * 100}
          cy={node.y * 40}
          r={node.slug === slug ? 4.5 : 2.2}
          className={node.slug === slug ? styles.glyphLit : styles.glyphNode}
        />
      ))}
    </svg>
  );
}
