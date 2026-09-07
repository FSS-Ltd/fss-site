import { TZDateMini } from "@date-fns/tz";
import calendar from "./bank-holidays.json";

export const operationsCalendarVersion = `england-wales-${calendar.retrievedAt}`;
const holidays = new Set(calendar.dates);
const zone = "Europe/London";
const hour = 60 * 60 * 1000;

function isBusinessDay(date: Date): boolean {
  const year = date.getFullYear();
  if (year < calendar.firstYear || year > calendar.lastYear)
    throw new Error("Operations holiday calendar needs a reviewed update.");
  const key = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return date.getDay() !== 0 && date.getDay() !== 6 && !holidays.has(key);
}

/** One business day is eight working hours, excluding configured bank holidays. */
export function addOperationsBusinessDays(from: Date, days: number): Date {
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 30
  )
    throw new Error("A valid date and 1–30 business days are required.");
  const cursor = new TZDateMini(from.getTime(), zone);
  let remaining = days * 8 * hour;
  while (remaining > 0) {
    if (!isBusinessDay(cursor) || cursor.getHours() >= 17) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
      continue;
    }
    if (cursor.getHours() < 9) cursor.setHours(9, 0, 0, 0);
    const close = new TZDateMini(cursor.getTime(), zone);
    close.setHours(17, 0, 0, 0);
    const elapsed = Math.min(remaining, close.getTime() - cursor.getTime());
    cursor.setTime(cursor.getTime() + elapsed);
    remaining -= elapsed;
  }
  return new Date(cursor.getTime());
}
