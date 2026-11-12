import { buildValueNetwork } from "./value-network";

/** The hero's static frame: the same lattice the canvas draws, as inline SVG so
 *  it paints with the HTML (no-JS, reduced motion, first paint) and is not an
 *  image candidate for the largest contentful paint, which stays the headline.
 *  The canvas reads the same view box (data-network-view) so the two match. */
export const networkView = { width: 840, height: 780, nodes: 150 };

const { nodes, edges } = buildValueNetwork(
  networkView.width,
  networkView.height,
  networkView.nodes,
);
const point = (index: number) =>
  `${Math.round(nodes[index].x * networkView.width)} ${Math.round(nodes[index].y * networkView.height)}`;
const lines = edges.map(([a, b]) => `M${point(a)}L${point(b)}`).join("");
const dots = nodes.map((_, index) => `M${point(index)}h0`).join("");

export function ValueNetworkPoster({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${networkView.width} ${networkView.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={lines}
        fill="none"
        stroke="rgba(20,152,158,.28)"
        strokeWidth=".85"
      />
      <path
        d={dots}
        fill="none"
        stroke="rgba(166,66,36,.6)"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
