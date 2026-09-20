export function studioDateLabel(value: string | null): string {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
