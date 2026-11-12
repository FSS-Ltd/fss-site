import type { BlogPostMeta } from "@/lib/types/blog";
import {
  type ArticleHeading,
  type RouteArt,
  buildRouteArt,
  shouldShowContents,
} from "@/lib/blog-presentation";
import { DrawIn } from "@/components/blog/draw-in";
import { CoverTransition } from "@/components/blog/cover-transition";
import styles from "@/components/blog/blog.module.css";

function Art({
  art,
  kickers,
  className,
  below = false,
}: {
  art: RouteArt;
  kickers: string[];
  className: string;
  /** Labels under the route (wide) or beside it (tall). */
  below?: boolean;
}) {
  const points = art.nodes.map((node) => `${node.x},${node.y}`).join(" ");
  return (
    <svg
      className={`${styles.artSvg} ${className}`}
      viewBox={`0 0 ${art.width} ${art.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {art.nodes.length > 1 ? (
        <polyline
          className={styles.artRoute}
          points={points}
          fill="none"
        />
      ) : null}
      {art.nodes.map((node, index) => {
        const top = below ? node.y + 40 : node.y - ((node.label.length - 1) * 19) / 2;
        const lx = below ? node.x - 9 : node.x + 24;
        return (
          <g
            key={index}
            className={styles.artNode}
            data-primary={node.primary ? "" : undefined}
          >
            <circle className={styles.artDot} cx={node.x} cy={node.y} r={9} />
            <text className={styles.artKicker} x={lx} y={top - 18}>
              {kickers[index]}
            </text>
            <text className={styles.artLabel} x={lx} y={top + 5}>
              {node.label.map((line, i) => (
                <tspan key={i} x={lx} dy={i === 0 ? 0 : 19}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Hero art for a post: its own h2s as labelled nodes on one rust route,
 *  matching the contents rail. A post with fewer than three headings shows
 *  itself and its related posts instead. Decorative; the headings and links
 *  it echoes are in the page. */
export function ArticleArt({
  post,
  headings,
  related,
}: {
  post: BlogPostMeta;
  headings: ArticleHeading[];
  related: BlogPostMeta[];
}) {
  const fromHeadings = shouldShowContents(headings);
  const labels = fromHeadings
    ? headings.map((heading) => heading.text)
    : [post.title, ...related.map((item) => item.title)];
  const kickers = fromHeadings
    ? labels.map((_, index) => String(index + 1).padStart(2, "0"))
    : labels.map((_, index) => (index === 0 ? "THIS ARTICLE" : "RELATED"));

  return (
    <figure className={styles.art} data-motion-reveal="up">
      <CoverTransition slug={post.slug}>
        <DrawIn>
          <Art art={buildRouteArt(labels, "wide")} kickers={kickers} className={styles.artWide} below />
          <Art art={buildRouteArt(labels, "tall")} kickers={kickers} className={styles.artTall} />
        </DrawIn>
      </CoverTransition>
    </figure>
  );
}
