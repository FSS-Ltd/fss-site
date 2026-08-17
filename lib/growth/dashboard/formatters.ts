const GROWTH_LOCALE = "en-GB" as const;
const GROWTH_TIME_ZONE = "Europe/London" as const;
const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const dateFormatter = new Intl.DateTimeFormat(GROWTH_LOCALE, {
  dateStyle: "medium",
  timeZone: GROWTH_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat(GROWTH_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: GROWTH_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat(GROWTH_LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
  timeZone: GROWTH_TIME_ZONE,
});

const wholePoundFormatter = new Intl.NumberFormat(GROWTH_LOCALE, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const partialPoundFormatter = new Intl.NumberFormat(GROWTH_LOCALE, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat(GROWTH_LOCALE, {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function parseDate(value: string): Date {
  const match = ISO_INSTANT_PATTERN.exec(value);

  if (!match) {
    throw new RangeError(
      "Growth dashboard dates must be ISO instants with an explicit offset.",
    );
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offset,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const offsetParts =
    offset === "Z" ? null : offset.slice(1).split(":").map(Number);
  const offsetHour = offsetParts?.[0] ?? 0;
  const offsetMinute = offsetParts?.[1] ?? 0;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    throw new RangeError("Growth dashboard dates must be valid ISO instants.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Growth dashboard dates must be valid ISO instants.");
  }

  return date;
}

export function formatGrowthDate(value: string): string {
  return dateFormatter.format(parseDate(value));
}

export function formatGrowthTime(value: string): string {
  return timeFormatter.format(parseDate(value));
}

export function formatGrowthDateTime(value: string): string {
  return dateTimeFormatter.format(parseDate(value));
}

export function formatGrowthCurrency(pence: number): string {
  if (!Number.isSafeInteger(pence)) {
    throw new RangeError("Growth dashboard money must use integer pence.");
  }

  const pounds = pence / 100;
  return (
    pence % 100 === 0 ? wholePoundFormatter : partialPoundFormatter
  ).format(pounds);
}

export function formatGrowthPercentage(ratio: number): string {
  if (!Number.isFinite(ratio)) {
    throw new RangeError("Growth dashboard percentages must be finite ratios.");
  }

  return percentageFormatter.format(ratio);
}

export function formatGrowthStatusLabel(status: string): string {
  const words = status
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "Unknown";
  }

  const label = words.join(" ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export function formatGrowthEvidenceCount(count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(
      "Growth dashboard evidence counts must be non-negative integers.",
    );
  }

  if (count === 0) {
    return "No evidence";
  }

  return `${count} evidence ${count === 1 ? "item" : "items"}`;
}
