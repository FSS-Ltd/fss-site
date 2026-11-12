import { writeFileSync } from "node:fs";
import { buildValueNetwork } from "../components/redesign/value-network";

/** The short value-network band every inner page header carries, drawn from the
 *  same geometry as the hero canvas. The hero's own poster is inline SVG
 *  (components/redesign/value-network-poster.tsx). Run: tsx scripts/build-network-svgs.ts */
function frame(width: number, height: number, count: number, file: string) {
  const { nodes, edges } = buildValueNetwork(width, height, count);
  const lines = edges
    .map(([a, b]) => {
      const [p, q] = [nodes[a], nodes[b]];
      return `<line x1="${(p.x * width).toFixed(1)}" y1="${(p.y * height).toFixed(1)}" x2="${(q.x * width).toFixed(1)}" y2="${(q.y * height).toFixed(1)}"/>`;
    })
    .join("");
  const dots = nodes
    .map(
      (p) =>
        `<circle cx="${(p.x * width).toFixed(1)}" cy="${(p.y * height).toFixed(1)}" r="1.8"/>`,
    )
    .join("");
  writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><g stroke="rgba(20,152,158,.28)" stroke-width=".85">${lines}</g><g fill="rgba(166,66,36,.6)">${dots}</g></svg>`,
  );
}

frame(1120, 120, 72, "public/redesign/mesh-band.svg");
