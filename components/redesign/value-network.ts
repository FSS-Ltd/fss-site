import { storyInterval } from "./story-progress";

type Position = { x: number; y: number };
type Network = { nodes: Position[]; edges: [number, number][] };

/** Stable, lightly irregular lattice. Connectivity never depends on the pointer. */
export function buildValueNetwork(
  width: number,
  height: number,
  count: number,
): Network {
  const columns = Math.max(
    3,
    Math.round(Math.sqrt((count * width) / Math.max(1, height))),
  );
  const rows = Math.max(3, Math.round(count / columns));
  const nodes: Position[] = [];
  const edges: [number, number][] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = nodes.length;
      const jitterX =
        column && column < columns - 1 ? Math.sin(index * 2.399) * 0.28 : 0;
      const jitterY =
        row && row < rows - 1 ? Math.cos(index * 1.713) * 0.28 : 0;
      nodes.push({
        x: 0.02 + (0.96 * (column + jitterX)) / (columns - 1),
        y: 0.02 + (0.96 * (row + jitterY)) / (rows - 1),
      });
      if (column) edges.push([index - 1, index]);
      if (row) edges.push([index - columns, index]);
      if (row && column && (row + column) % 2 === 0)
        edges.push([index - columns - 1, index]);
    }
  }
  return { nodes, edges };
}

export function networkFormation(
  progress: number,
  point: Position,
  connection = false,
): number {
  const start =
    0.02 + (0.82 * (point.x + 1 - point.y)) / 2 + (connection ? 0.07 : 0);
  return storyInterval(progress, start, start + 0.1);
}

export function networkPointerOffset(
  anchor: Position,
  pointer: Position | null,
): Position {
  if (!pointer) return { x: 0, y: 0 };
  const dx = anchor.x - pointer.x;
  const dy = anchor.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (!distance || distance >= 160) return { x: 0, y: 0 };
  const strength = 3 * (1 - distance / 160);
  return { x: (dx / distance) * strength, y: (dy / distance) * strength };
}
