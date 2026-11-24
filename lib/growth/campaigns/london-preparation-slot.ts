const londonTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function isLondonPreparationSlot(now: Date): boolean {
  if (!Number.isFinite(now.getTime())) return false;
  const parts = londonTime.formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour === "08" && minute >= 30 && minute < 35;
}

export function isOutreachPreparationEnabled(
  value: string | undefined,
): boolean {
  return value === "true";
}
