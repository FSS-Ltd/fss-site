import { storyInterval } from "./story-progress";

export function getAppAtomProgress(progress: number, index: number): number {
  const order = ((index * 733) % 3557) / 3557;
  return storyInterval(progress, 0.4 + order * 0.32, 0.58 + order * 0.32);
}
