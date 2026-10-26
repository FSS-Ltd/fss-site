import { z } from "zod";
import { contactSchema } from "@/lib/growth/crm/schemas";
import { fieldText, localInstant, nullableText } from "./form-values";

const sourcedContactSchema = z.object({ contact: contactSchema });

export function sourcedContact(data: FormData) {
  return sourcedContactSchema.parse({
    contact: {
      firstName: fieldText(data, "firstName"),
      lastName: fieldText(data, "lastName"),
      email: fieldText(data, "email"),
      roleTitle: nullableText(data, "roleTitle"),
      sourceUrl: fieldText(data, "emailSource"),
      verifiedAt: localInstant(fieldText(data, "verifiedAt")),
      lawfulBasis: fieldText(data, "lawfulBasis"),
    },
  }).contact;
}
