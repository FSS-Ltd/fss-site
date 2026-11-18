export type ReplyCoverageInterval = {
  state: "complete" | "gap";
  observedFrom: Date | null;
  observedUntil: Date;
  grantEpoch: number;
  googleSubject: string;
};

export function hasCompleteReplyCoverage(
  intervals: readonly ReplyCoverageInterval[],
  googleSubject: string,
  from: Date,
  until: Date,
): boolean {
  const start = from.getTime();
  const end = until.getTime();
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    !googleSubject.trim()
  )
    return false;
  const relevant = intervals.filter(
    (interval) => interval.googleSubject === googleSubject,
  );
  for (const interval of relevant) {
    const left = interval.observedFrom?.getTime() ?? -Infinity;
    const right = interval.observedUntil.getTime();
    if (
      !Number.isSafeInteger(interval.grantEpoch) ||
      interval.grantEpoch <= 0 ||
      !Number.isFinite(right) ||
      (interval.observedFrom && !Number.isFinite(left)) ||
      left >= right ||
      (interval.state === "complete" && !interval.observedFrom)
    )
      return false;
    if (interval.state === "gap" && left < end && right > start) return false;
  }
  const complete = relevant
    .flatMap((interval) =>
      interval.state === "complete" && interval.observedFrom
        ? [
            {
              from: interval.observedFrom.getTime(),
              until: interval.observedUntil.getTime(),
            },
          ]
        : [],
    )
    .sort((a, b) => a.from - b.from);
  let covered = start;
  for (const interval of complete) {
    const left = interval.from;
    const right = interval.until;
    if (left > covered) break;
    covered = Math.max(covered, right);
    if (covered >= end) return true;
  }
  return false;
}
