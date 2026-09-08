import { TZDateMini } from "@date-fns/tz";
export const onboardingTimeZone = "Europe/London";
export const providerDedupeWindowMs = 24 * 60 * 60 * 1000;
function valid(date: Date): void {
  if (!Number.isFinite(date.getTime()))
    throw new Error("A valid timestamp is required.");
}
export function proposalDueAt(acceptedAt: Date): Date {
  valid(acceptedAt);
  return new Date(acceptedAt.getTime() + 2 * 60 * 60 * 1000);
}
export function followingLondonMorning(signedAt: Date): Date {
  valid(signedAt);
  const local = new TZDateMini(signedAt.getTime(), onboardingTimeZone);
  local.setDate(local.getDate() + 1);
  local.setHours(9, 0, 0, 0);
  return new Date(local.getTime());
}
export function retryAt(
  now: Date,
  failures: number,
  retryAfterMs = 0,
): Date | null {
  valid(now);
  const minutes = [1, 5, 15, 60, 240][failures - 1];
  if (minutes === undefined) return null;
  const delay = Math.max(minutes * 60_000, retryAfterMs, 0);
  const next = new Date(now.getTime() + delay);
  return Number.isFinite(next.getTime()) ? next : null;
}
export function expiredUnknownAttempt(
  firstAttemptAt: string | null,
  now: Date,
): boolean {
  return (
    firstAttemptAt !== null &&
    now.getTime() - new Date(firstAttemptAt).getTime() >= providerDedupeWindowMs
  );
}
