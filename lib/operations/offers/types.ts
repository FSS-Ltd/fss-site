import { z } from "zod";

export const offerEnquirySchema = z.strictObject({
  offerId: z.uuid(),
  idempotencyKey: z.uuid(),
  interest: z.string().trim().min(1).max(4000),
  context: z
    .record(z.string().max(80), z.string().trim().max(1000))
    .default({}),
});

export type Offer = {
  id: string;
  name: string;
  outcome: string;
  audience: string;
  inclusions: string[];
  exclusions: string[];
  setupNeeds: string[];
  supportHours: string;
  pricingDisplay: "fixed" | "from" | "quote";
  pricePence: string | null;
  recurrence: "one_off" | "monthly" | "quarterly" | "annual" | null;
};

export type OfferEnquiry = z.infer<typeof offerEnquirySchema>;
