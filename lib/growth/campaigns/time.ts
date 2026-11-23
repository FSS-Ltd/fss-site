import { TZDateMini } from "@date-fns/tz";
const zone = "Europe/London";
export function londonDayKey(now: Date): string {
  const d = new TZDateMini(now.getTime(), zone);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function campaignMonthAnniversary(firstSentAt: Date): Date {
  const d = new TZDateMini(firstSentAt.getTime(), zone);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const next = new TZDateMini(d.getTime(), zone);
  next.setMonth(next.getMonth() + 1);
  next.setDate(0);
  d.setDate(Math.min(day, next.getDate()));
  return new Date(d.getTime());
}

export function campaignCadenceDays(
  family: "review" | "facebook" | "website",
): readonly [number, number] {
  return family === "review" ? [5, 10] : [2, 4];
}

/** A millisecond clock cannot represent an observation's remaining microseconds. */
export function campaignSchedulingAnchor(
  observedAt: Date,
  basis: string | null,
  hasSubMillisecond: boolean,
): Date {
  return new Date(
    observedAt.getTime() +
      (basis === "resend_fss_delivery_observed" && hasSubMillisecond ? 1 : 0),
  );
}
