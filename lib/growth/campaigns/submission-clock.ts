import type { AuthorityBounds } from "./authority-bounds";
import type { SendWindow } from "./dispatch-authority";
import { londonDayKey } from "./time";

export type SubmissionClock = {
  londonDay: string;
  bounds: AuthorityBounds;
  window: SendWindow | null;
};
export function withinSubmissionClock(
  authority: SubmissionClock,
  now: Date,
): boolean {
  const at = now.getTime();
  if (
    !Number.isFinite(at) ||
    londonDayKey(now) !== authority.londonDay ||
    at < authority.bounds.validatedAt.getTime() ||
    at >= authority.bounds.expiresAt.getTime() ||
    (authority.bounds.validThrough !== null &&
      at > authority.bounds.validThrough.getTime())
  )
    return false;
  if (!authority.window) return true;
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: authority.window.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      local.find((part) => part.type === "weekday")?.value ?? "",
    ) + 1;
  const time = `${local.find((part) => part.type === "hour")?.value}:${local.find((part) => part.type === "minute")?.value}`;
  return (
    authority.window.weekdays.includes(weekday) &&
    time >= authority.window.start &&
    time < authority.window.end
  );
}
