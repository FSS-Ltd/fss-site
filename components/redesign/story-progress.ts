/** A clamped, eased interval with a stationary reading zone between transitions. */
export function storyInterval(
  progress: number,
  start: number,
  end: number,
): number {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

export function storyChapter(progress: number, index: number, count = 3) {
  const start = index / count;
  const enter =
    index === 0 ? 1 : storyInterval(progress, start - 0.2 / count, start);
  const leave =
    index === count - 1
      ? 0
      : storyInterval(progress, start + 0.72 / count, start + 1 / count);
  return {
    opacity: enter * (1 - leave),
    y: (1 - enter) * 90 - leave * 70,
    mask: (1 - enter) * 100,
  };
}
