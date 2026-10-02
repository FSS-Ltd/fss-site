import { currencySchema } from "../money";
import { z } from "zod";
import { londonDate } from "./definitions";
const optionalText = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().max(160).optional(),
);
const optionalUuid = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.uuid().optional(),
);
const date = z.iso.date();
export function parseMetricFilters(raw: unknown, observedAt: string) {
  const today = londonDate(observedAt);
  return z
    .object({
      from: date.default(`${today.slice(0, 7)}-01`),
      to: date.default(today),
      organisationId: optionalUuid,
      client: optionalText,
      service: optionalText,
      owner: optionalText,
      currency: currencySchema.default("GBP"),
      paymentState: z
        .enum([
          "all",
          "pending",
          "processing",
          "succeeded",
          "failed",
          "canceled",
          "unknown",
        ])
        .default("all"),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
    })
    .refine(
      (v) => v.from <= v.to && v.to <= today,
      "Period must end on or before today.",
    )
    .parse(raw);
}
export type MetricFilters = ReturnType<typeof parseMetricFilters>;
export type MetricProviderScope = {
  accountId: string;
  mode: "test" | "live";
} | null;
