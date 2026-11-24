import { z } from "zod";

export const websiteServiceTermsSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  monthlyPence: z.number().int().nonnegative(),
  description: z.string().min(1),
  currency: z.literal("GBP"),
  services: z.array(z.string().min(1)).min(1),
  websiteScope: z.string().min(1),
  setupFeePence: z.number().int().nonnegative(),
  minimumTerm: z.string().min(1),
  cancellation: z.string().min(1),
});
export type WebsiteServiceTerms = z.infer<typeof websiteServiceTermsSchema>;

const common = {
  currency: "GBP",
  websiteScope: "entire website build excluding GoHighLevel service add-ons",
  setupFeePence: 0,
  minimumTerm: "none",
  cancellation: "anytime",
} as const;

// These immutable versioned seeds are copied into the approved policy JSON.
export const websiteServiceOffers = {
  lead_review_essentials_v1: {
    ...common,
    id: "lead_review_essentials_v1" as const,
    name: "Lead & Review Essentials",
    monthlyPence: 29700,
    description:
      "Automatic enquiry follow-up, a website appointment assistant and Google review requests, configured around your business and managed by FSS.",
    services: [
      "automatic enquiry follow-up",
      "website appointment assistant",
      "Google review requests",
    ],
  },
  booking_recovery_v1: {
    ...common,
    id: "booking_recovery_v1" as const,
    name: "Booking & Recovery",
    monthlyPence: 49700,
    description:
      "Recover unanswered quotes, missed appointments and repeat business.",
    services: ["unanswered quotes", "missed appointments", "repeat business"],
  },
  ai_front_desk_v1: {
    ...common,
    id: "ai_front_desk_v1" as const,
    name: "AI Front Desk",
    monthlyPence: 79700,
    description:
      "Managed inbound call answering, qualification, booking and human handover.",
    services: [
      "inbound call answering",
      "qualification",
      "booking",
      "human handover",
    ],
  },
} satisfies Record<string, WebsiteServiceTerms>;

for (const offer of Object.values(websiteServiceOffers)) {
  Object.freeze(offer.services);
  Object.freeze(offer);
}
Object.freeze(websiteServiceOffers);

export type WebsiteServiceOfferId = keyof typeof websiteServiceOffers;

export function isWebsiteServiceOffer(id: string): id is WebsiteServiceOfferId {
  return Object.hasOwn(websiteServiceOffers, id);
}

export function matchesWebsiteServiceOffer(
  id: string,
  value: unknown,
): value is WebsiteServiceTerms {
  if (!isWebsiteServiceOffer(id)) return false;
  const parsed = websiteServiceTermsSchema.safeParse(value);
  if (!parsed.success) return false;
  const actual = parsed.data;
  const expected = websiteServiceOffers[id];
  return (
    actual.id === expected.id &&
    actual.name === expected.name &&
    actual.monthlyPence === expected.monthlyPence &&
    actual.description === expected.description &&
    actual.currency === expected.currency &&
    actual.websiteScope === expected.websiteScope &&
    actual.setupFeePence === expected.setupFeePence &&
    actual.minimumTerm === expected.minimumTerm &&
    actual.cancellation === expected.cancellation &&
    actual.services.length === expected.services.length &&
    actual.services.every(
      (service, index) => service === expected.services[index],
    )
  );
}
