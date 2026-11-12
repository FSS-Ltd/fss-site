import { writeFileSync } from "node:fs";
import { buildValueNetwork } from "../components/redesign/value-network";

/** The static value-network frames, drawn from the same geometry as the hero
 *  canvas: the band every inner page header carries, its 404 variant with one
 *  node cut loose, and the services page's six numbered services.
 *  The hero's own poster is inline SVG (components/redesign/value-network-poster.tsx).
 *  Run: tsx scripts/build-network-svgs.ts */
const teal = "rgba(20,152,158,.28)";
const rust = "rgba(166,66,36,.6)";

function frame(
  width: number,
  height: number,
  count: number,
  file: string,
  detach = false,
) {
  const { nodes, edges } = buildValueNetwork(width, height, count);
  const at = (i: number) => ({ x: nodes[i].x * width, y: nodes[i].y * height });
  // 404: the node nearest the left-centre drifts off; its links are cut, leaving
  // two stubs that stop short of each other.
  let lost = -1;
  if (detach) {
    lost = nodes.reduce(
      (best, p, i) =>
        Math.hypot(p.x - 0.3, p.y - 0.5) <
        Math.hypot(nodes[best].x - 0.3, nodes[best].y - 0.5)
          ? i
          : best,
      0,
    );
  }
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
  const drift = (i: number) =>
    i === lost ? { x: at(i).x + 46, y: at(i).y + 26 } : at(i);
  const lines = edges
    .filter(([a, b]) => a !== lost && b !== lost)
    .map(([a, b]) => line(at(a), at(b)))
    .join("");
  const stubs = detach
    ? edges
        .filter(([a, b]) => a === lost || b === lost)
        .slice(0, 1)
        .map(([a, b]) => {
          const near = at(a === lost ? b : a);
          const far = drift(lost);
          const cut = (t: number) => ({
            x: near.x + (far.x - near.x) * t,
            y: near.y + (far.y - near.y) * t,
          });
          return line(near, cut(0.4)) + line(cut(0.74), far);
        })
        .join("")
    : "";
  const dots = nodes
    .map((_, i) => {
      const p = drift(i);
      return i === lost
        ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2" fill="none" stroke="#a64224" stroke-width="1.6"/>`
        : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.8"/>`;
    })
    .join("");
  writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><g stroke="${teal}" stroke-width=".85">${lines}${stubs}</g><g fill="${rust}">${dots}</g></svg>`,
  );
}

frame(1120, 120, 72, "public/redesign/mesh-band.svg");
frame(1120, 120, 72, "public/redesign/mesh-band-lost.svg", true);

/** Services: the six numbered services as parts of one system, FSS at the hub.
 *  Numbers match the cards on the page (01 to 06). */
function services(file: string) {
  const width = 1200;
  const height = 750;
  const parts = [
    { n: "01", name: "AI integration", x: 230, y: 175 },
    { n: "02", name: "AI agents", x: 600, y: 115 },
    { n: "03", name: "Readiness audit", x: 970, y: 175 },
    { n: "04", name: "Automation", x: 230, y: 585 },
    { n: "05", name: "Private AI", x: 600, y: 645 },
    { n: "06", name: "Custom software", x: 970, y: 585 },
  ];
  const hub = { x: 600, y: 380 };
  const { nodes, edges } = buildValueNetwork(width, height, 90);
  const mesh = edges
    .map(([a, b]) => {
      const [p, q] = [nodes[a], nodes[b]];
      return `<line x1="${(p.x * width).toFixed(1)}" y1="${(p.y * height).toFixed(1)}" x2="${(q.x * width).toFixed(1)}" y2="${(q.y * height).toFixed(1)}"/>`;
    })
    .join("");
  const spokes = parts
    .map((p) => `<line x1="${p.x}" y1="${p.y}" x2="${hub.x}" y2="${hub.y}"/>`)
    .join("");
  // Round the ring (01, 02, 03, 06, 05, 04) so the outline never crosses a spoke.
  const route = [0, 1, 2, 5, 4, 3]
    .map((i) => `${parts[i].x} ${parts[i].y}`)
    .join("L");
  const marks = parts
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="36" fill="#fffaf6" stroke="#a64224" stroke-width="3"/><text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="#a64224">${p.n}</text><text x="${p.x}" y="${p.y + 66}" text-anchor="middle" font-size="30" font-weight="600" fill="#2b2420" stroke="#f1f3f5" stroke-width="7" paint-order="stroke">${p.name}</text>`,
    )
    .join("");
  writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Geist, ui-sans-serif, system-ui, sans-serif"><rect width="${width}" height="${height}" fill="#f1f3f5"/><g stroke="${teal}" stroke-width="1.2" opacity=".7">${mesh}</g><g stroke="rgba(20,152,158,.6)" stroke-width="2">${spokes}</g><path d="M${route}Z" fill="none" stroke="rgba(166,66,36,.85)" stroke-width="3" stroke-linejoin="round"/>${marks}<circle cx="${hub.x}" cy="${hub.y}" r="56" fill="#a64224"/><text x="${hub.x}" y="${hub.y}" text-anchor="middle" dominant-baseline="central" font-size="34" font-weight="700" fill="#fff">FSS</text></svg>`,
  );
}

services("public/redesign/services-network.svg");
