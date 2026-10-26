export function fieldText(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}
export function nullableText(data: FormData, name: string): string | null {
  return fieldText(data, name) || null;
}
export function moneyPence(data: FormData, name: string): number {
  const value = fieldText(data, name);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter money as pounds with at most two decimal places.");
  const pence = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(pence) || pence > 2_000_000_000)
    throw new Error("This amount is too large.");
  return pence;
}
export function localInstant(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("Enter a valid due date and time.");
  return date.toISOString();
}
export function localDateTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
