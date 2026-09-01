import { TZDate } from "@date-fns/tz";
import {
  addDays,
  getDay,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
} from "date-fns";

const TIMEZONE = "Europe/London";
const SEND_HOUR = 10;

export const FOLLOW_UP_LABELS = ["day_5", "day_11", "day_14"] as const;
export type FollowUpLabel = (typeof FOLLOW_UP_LABELS)[number];

// Day 11 is intentionally excluded: it is an individual SEO/AEO audit email
// that is drafted by the daily agent and requires founder approval.
export const AUTOMATED_FOLLOW_UP_LABELS = ["day_5", "day_14"] as const;

const FOLLOW_UP_CALENDAR_OFFSETS: Record<FollowUpLabel, number> = {
  day_5: 4,
  day_11: 10,
  day_14: 13,
};

function atLocalSendTime(date: TZDate): TZDate {
  return setMilliseconds(
    setSeconds(setMinutes(setHours(date, SEND_HOUR), 0), 0),
    0,
  );
}

function moveWeekendToMonday(date: TZDate): TZDate {
  const weekday = getDay(date);
  if (weekday === 0) return addDays(date, 1);
  if (weekday === 6) return addDays(date, 2);
  return date;
}

export function scheduleFollowUp(
  firstSentAt: Date,
  label: FollowUpLabel,
): Date {
  const zonedFirstSentAt = new TZDate(firstSentAt, TIMEZONE);
  const target = addDays(zonedFirstSentAt, FOLLOW_UP_CALENDAR_OFFSETS[label]);
  const onABusinessDay = moveWeekendToMonday(target);
  const atSendTime = atLocalSendTime(onABusinessDay);

  return new Date(atSendTime.getTime());
}

export function scheduleFollowUps(
  firstSentAt: Date,
): Record<FollowUpLabel, Date> {
  return {
    day_5: scheduleFollowUp(firstSentAt, "day_5"),
    day_11: scheduleFollowUp(firstSentAt, "day_11"),
    day_14: scheduleFollowUp(firstSentAt, "day_14"),
  };
}
