import { z } from "zod";
import { leadMagnetCaptureSchema, leadSubmissionSchema } from "./lead-capture";

export const contactServices = [
  "Custom software",
  "App or SaaS",
  "AI automation",
  "Private / local AI",
  "Not sure yet",
] as const;
export type ContactService = (typeof contactServices)[number];
export type ContactValues = z.infer<typeof leadMagnetCaptureSchema> & {
  service: ContactService;
  newsletterOptIn: boolean;
};

export function contactChallengeLimit(service: ContactService): number {
  return service === "Not sure yet" ? 600 : 600 - service.length - 2;
}

export function prepareContactRequest(
  values: ContactValues,
  submissionId: string,
) {
  const challenge = values.challenge?.trim() ?? "";
  return leadSubmissionSchema.safeParse({
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    workEmail: values.workEmail.trim(),
    company: values.company.trim(),
    challenge:
      values.service === "Not sure yet"
        ? challenge || undefined
        : `${values.service}: ${challenge}`.trim(),
    newsletterOptIn: values.newsletterOptIn,
    sourceContext: "contact-page-v2",
    sourcePath: "/contact",
    submissionId,
  });
}
