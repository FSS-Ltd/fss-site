import { z } from "zod";

export const currencies = ["GBP", "USD", "EUR"] as const;
export const currencySchema = z.enum(currencies);
export type Currency = z.infer<typeof currencySchema>;

export function currencyLabel(currency: Currency): string {
  return {
    GBP: "British pound (GBP)",
    USD: "US dollar (USD)",
    EUR: "Euro (EUR)",
  }[currency];
}

export function currencySymbol(currency: Currency): string {
  return { GBP: "£", USD: "$", EUR: "€" }[currency];
}

export function stripeCurrency(currency: Currency): "gbp" | "usd" | "eur" {
  const codes: Record<Currency, "gbp" | "usd" | "eur"> = {
    GBP: "gbp",
    USD: "usd",
    EUR: "eur",
  };
  return codes[currency];
}

export function parseStripeCurrency(value: string): Currency {
  return currencySchema.parse(value.toUpperCase());
}

export function decimalToMinor(value: string): string {
  const amount = value.trim();
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(amount)) {
    throw new Error("Use a nonnegative amount with up to two decimal places.");
  }
  const [whole, fraction = ""] = amount.split(".");
  return (
    BigInt(whole) * BigInt(100) +
    BigInt(fraction.padEnd(2, "0"))
  ).toString();
}

export function minorToDecimal(value: string): string {
  if (!/^(0|[1-9]\d{0,29})$/.test(value)) {
    throw new Error(
      "Use nonnegative whole minor units within the supported range.",
    );
  }
  const amount = BigInt(value);
  return `${amount / BigInt(100)}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}

export function formatMoney(value: string, currency: Currency): string {
  const [whole, fraction] = minorToDecimal(value).split(".");
  return `${currencySymbol(currency)}${BigInt(whole).toLocaleString("en-GB")}.${fraction}`;
}
