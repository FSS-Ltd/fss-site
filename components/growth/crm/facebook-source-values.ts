import { z } from "zod";
import { sourceLeadInputSchema } from "@/lib/growth/campaigns/schemas";
import { fieldText, localInstant, nullableText } from "./form-values";

export function facebookSourceCommand(data: FormData, requestId: string) {
  const result = sourceLeadInputSchema.safeParse({
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
