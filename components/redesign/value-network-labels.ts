import { storyInterval } from "./story-progress";

type Position = { x: number; y: number };
export type NetworkLabel = {
  name: string;
  /** Resting place on the clean path. */
  x: number;
  y: number;
  /** Where the part sits before FSS connects anything. */
  sx: number;
  sy: number;
};

/** The parts of a business, using nouns the site already uses. FSS is the hub. */
export const businessParts = [
  "Inbox",
  "Calls",
  "CRM",
  "Invoices",
  "Rota",
  "Reports",
] as const;
export const hubName = "FSS";

const label = (name: string, at: Position, from: Position): NetworkLabel => ({
  name,
  x: at.x,
  y: at.y,
  sx: from.x,
  sy: from.y,
});

/** Hero: one path zigzags down the right of the 840x780 view, clear of the headline. */
const heroPath: Position[] = [
  { x: 0.58, y: 0.14 },
  { x: 0.78, y: 0.24 },
  { x: 0.6, y: 0.35 },
  { x: 0.77, y: 0.46 },
  { x: 0.6, y: 0.57 },
  { x: 0.77, y: 0.67 },
  { x: 0.64, y: 0.77 },
];
export const heroLabels: NetworkLabel[] = [...businessParts, hubName].map(
  (name, index) => label(name, heroPath[index], heroPath[index]),
);

/** Scroll story: a level run along the lower band, below the chapter text. */
const storyPath: Position[] = [
  { x: 0.1, y: 0.84 },
  { x: 0.24, y: 0.78 },
  { x: 0.38, y: 0.84 },
  { x: 0.52, y: 0.78 },
  { x: 0.66, y: 0.84 },
  { x: 0.8, y: 0.78 },
  { x: 0.92, y: 0.84 },
];
const storyScatter: Position[] = [
  { x: 0.62, y: 0.76 },
  { x: 0.14, y: 0.9 },
  { x: 0.8, y: 0.88 },
  { x: 0.3, y: 0.72 },
  { x: 0.9, y: 0.74 },
  { x: 0.46, y: 0.91 },
  { x: 0.52, y: 0.8 },
];
export const storyLabels: NetworkLabel[] = [...businessParts, hubName].map(
  (name, index) => label(name, storyPath[index], storyScatter[index]),
);

/** Step 2's joined view: every part reaches the hub, and each neighbour. */
export const labelWeb: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  ...[0, 1, 2, 3, 4, 5].map((index): [number, number] => [index, 6]),
];

/** How far each step of the story has got: parts scattered and unlinked, then
 *  joined into one view, then one clean path ending at FSS. */
export function networkStage(progress: number) {
  return {
    settle: storyInterval(progress, 0.3, 0.86),
    join: storyInterval(progress, 0.3, 0.4),
    path: storyInterval(progress, 0.74, 0.86),
  };
}

export const settledStage = { settle: 1, join: 1, path: 1 };

export function labelPosition(item: NetworkLabel, settle: number): Position {
  return {
    x: item.sx + (item.x - item.sx) * settle,
    y: item.sy + (item.y - item.sy) * settle,
  };
}

/** Nodes near the pointer lean towards it and light up; nothing accumulates. */
export function labelPull(
  anchor: Position,
  pointer: Position | null,
  radius = 220,
  reach = 9,
) {
  if (!pointer) return { x: 0, y: 0, glow: 0 };
  const dx = pointer.x - anchor.x;
  const dy = pointer.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  if (!distance || distance >= radius) return { x: 0, y: 0, glow: 0 };
  const near = 1 - distance / radius;
  return {
    x: (dx / distance) * reach * near,
    y: (dy / distance) * reach * near,
    glow: near,
  };
}
