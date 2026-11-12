import type { BlogPostMeta } from "@/lib/types/blog";
import {
  ART_NODE_RADIUS,
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
}: {
  art: RouteArt;
  kickers: string[];
  className: string;
}) {
  return (
    <svg
      className={`${styles.artSvg} ${className}`}
      viewBox={`0 0 ${art.width} ${art.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {art.legs.map((leg, index) => (
        <polyline
          key={index}
          className={styles.artRoute}
          points={leg.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
        />
      ))}
      {art.nodes.map((node, index) => (
        <g
          key={index}
          className={styles.artNode}
          data-primary={node.primary ? "" : undefined}
        >
          <circle
            className={styles.artDot}
            cx={node.x}
            cy={node.y}
            r={ART_NODE_RADIUS}
          />
          <text className={styles.artKicker} x={node.kicker.x} y={node.kicker.y}>
            {kickers[index]}
          </text>
          <text className={styles.artLabel} x={node.text.x} y={node.text.y}>
            {node.label.map((line, i) => (
              <tspan key={i} x={node.text.x} dy={i === 0 ? 0 : 19}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      ))}
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
          <Art art={buildRouteArt(labels, "wide")} kickers={kickers} className={styles.artWide} />
          <Art art={buildRouteArt(labels, "tall")} kickers={kickers} className={styles.artTall} />
        </DrawIn>
      </CoverTransition>
    </figure>
  );
}
