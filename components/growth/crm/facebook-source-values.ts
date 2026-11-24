import { z } from "zod";
import { sourceLeadInputSchema } from "@/lib/growth/campaigns/schemas";
import { fieldText, localInstant, nullableText } from "./form-values";

const facebookSourceSchema = sourceLeadInputSchema.superRefine(
  (input, context) => {
    for (const [name, label] of [
      ["businessName", "business name"],
      ["opportunity", "opportunity"],
      ["offer", "recommended offer"],
    ] as const) {
      if (!input[name].trim())
        context.addIssue({
          code: "custom",
          path: [name],
          message: `Enter ${label}.`,
        });
    }
    if (input.observedAt.getTime() > Date.now())
      context.addIssue({
        code: "custom",
        path: ["observedAt"],
        message: "Observation time cannot be in the future.",
      });
  },
);

export function facebookSourceCommand(data: FormData, requestId: string) {
  const result = facebookSourceSchema.safeParse({
    requestId,
    sourceType: "facebook_page",
    sourceUrl: fieldText(data, "sourceUrl"),
    businessName: fieldText(data, "businessName"),
    countryCode: fieldText(data, "countryCode"),
    corporateType: nullableText(data, "corporateType"),
    registrationNumber: nullableText(data, "registrationNumber"),
    firstName: nullableText(data, "firstName"),
    lastName: nullableText(data, "lastName"),
    email: nullableText(data, "email"),
    opportunity: fieldText(data, "opportunity"),
    offer: fieldText(data, "offer"),
    observedAt: localInstant(fieldText(data, "observedAt")),
  });
  if (!result.success) {
    throw new z.ZodError(
      result.error.issues.map((issue) =>
        issue.path.length ? issue : { ...issue, path: ["sourceUrl"] },
      ),
    );
  }
  return { kind: "capture_source" as const, ...result.data };
}
