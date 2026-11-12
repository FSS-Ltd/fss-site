import { buildValueNetwork } from "./value-network";
import { heroLabels, hubName } from "./value-network-labels";

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

const labelAt = (item: (typeof heroLabels)[number]) => ({
  name: item.name,
  x: Math.round(item.x * networkView.width),
  y: Math.round(item.y * networkView.height),
});
const parts = heroLabels.map(labelAt);
const route = parts.map((part) => `${part.x} ${part.y}`).join("L");

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
      {/* Same labelled parts and rust path as the canvas. Hidden on phones, where
          the headline sits over the mesh (the canvas skips them there too). */}
      <style>{"@media(max-width:900px){.nl{display:none}}"}</style>
      <g className="nl" fontFamily="inherit" fontWeight="600" fontSize="12.5">
        <path
          d={`M${route}`}
          fill="none"
          stroke="rgba(166,66,36,.9)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {parts.map((part) =>
          part.name === hubName ? (
            <g key={part.name}>
              <circle cx={part.x} cy={part.y} r="17" fill="#a64224" />
              <text
                x={part.x}
                y={part.y}
                fill="#fff"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {part.name}
              </text>
            </g>
          ) : (
            <g key={part.name}>
              <circle
                cx={part.x}
                cy={part.y}
                r="5.5"
                fill="#fffaf6"
                stroke="#a64224"
                strokeWidth="2"
              />
              <text
                x={part.x}
                y={part.y - 17}
                fill="#2b2420"
                stroke="rgba(245,246,247,.92)"
                strokeWidth="4"
                paintOrder="stroke"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {part.name}
              </text>
            </g>
          ),
        )}
      </g>
    </svg>
  );
}
