import type { ReplyCoverageInterval } from "../sequences/gmail-sync-coverage";

type Window = { from: number; until: number };
type Group = { invalid: boolean; complete: Window[]; gaps: Window[] };
export type CoverageRecord = ReplyCoverageInterval & { connectionId: string };
function merge(windows: Window[]): Window[] {
  windows.sort((a, b) => a.from - b.from || a.until - b.until);
  const merged: Window[] = [];
  for (const window of windows) {
    const last = merged.at(-1);
    if (last && window.from <= last.until)
      last.until = Math.max(last.until, window.until);
    else merged.push({ ...window });
  }
  return merged;
}
function lastStartingBefore(
  windows: Window[],
  point: number,
  inclusive: boolean,
): Window | undefined {
  let lo = 0,
    hi = windows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (inclusive ? windows[mid].from <= point : windows[mid].from < point)
      lo = mid + 1;
    else hi = mid;
  }
  return lo ? windows[lo - 1] : undefined;
}
export function indexReportCoverage(
  records: readonly CoverageRecord[],
): (
  connectionId: string,
  subject: string,
  from: Date,
  until: Date,
  grantEpoch?: number,
) => boolean {
  const groups = new Map<string, Group>();
  for (const record of records) {
    const keys = [
      JSON.stringify([record.connectionId, record.googleSubject]),
      JSON.stringify([
        record.connectionId,
        record.googleSubject,
        record.grantEpoch,
      ]),
    ];
    for (const key of keys) {
      const group = groups.get(key) ?? {
        invalid: false,
        complete: [],
        gaps: [],
      };
      groups.set(key, group);
      const from = record.observedFrom?.getTime() ?? -Infinity,
        until = record.observedUntil.getTime();
      if (
        !Number.isSafeInteger(record.grantEpoch) ||
        record.grantEpoch <= 0 ||
        !Number.isFinite(until) ||
        (record.observedFrom !== null && !Number.isFinite(from)) ||
        from >= until ||
        (record.state === "complete" && !record.observedFrom)
      ) {
        group.invalid = true;
        continue;
      }
      (record.state === "complete" ? group.complete : group.gaps).push({
        from,
        until,
      });
    }
  }
  for (const group of groups.values()) {
    group.complete = merge(group.complete);
    group.gaps = merge(group.gaps);
  }
  return (connectionId, subject, from, until, grantEpoch) => {
    const start = from.getTime(),
      end = until.getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      !subject.trim()
    )
      return false;
    const group = groups.get(
      JSON.stringify(
        grantEpoch === undefined
          ? [connectionId, subject]
          : [connectionId, subject, grantEpoch],
      ),
    );
    if (!group || group.invalid) return false;
    const gap = lastStartingBefore(group.gaps, end, false);
    if (gap && gap.until > start) return false;
    const complete = lastStartingBefore(group.complete, start, true);
    return !!complete && complete.until >= end;
  };
}
