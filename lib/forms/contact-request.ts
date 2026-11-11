import { z } from "zod";
import { leadMagnetCaptureSchema, leadSubmissionSchema } from "./lead-capture";

export const contactNeeds = [
  "Answer calls and enquiries",
  "Admin and data entry",
  "Reporting",
  "Connect our systems",
  "AI on our own data, privately",
  "Custom software",
  "Not sure yet",
] as const;
export const contactTools = [
  "Microsoft 365",
  "Google Workspace",
  "Xero",
  "HubSpot",
  "Salesforce",
  "Spreadsheets",
  "Other",
] as const;
export const contactTeamSizes = [
  "Just me",
  "2 to 10",
  "11 to 50",
  "51 to 250",
  "250+",
] as const;
export const contactTimings = [
  "As soon as possible",
  "Within 3 months",
  "3 to 6 months",
  "Just exploring",
] as const;

export type ContactNeed = (typeof contactNeeds)[number];
export type ContactTool = (typeof contactTools)[number];
export type ContactTeamSize = (typeof contactTeamSizes)[number];
export type ContactTiming = (typeof contactTimings)[number];

export type ContactAnswers = {
  need: ContactNeed | "";
  detail: string;
  tools: ContactTool[];
  teamSize: ContactTeamSize | "";
  timing: ContactTiming | "";
};

export type ContactValues = Pick<
  z.infer<typeof leadMagnetCaptureSchema>,
  "firstName" | "lastName" | "workEmail" | "company"
> &
  ContactAnswers & { newsletterOptIn: boolean };

const challengeLimit = 600;
const detailPrefix = "Detail: ";

function structuredSegments(answers: ContactAnswers): string[] {
  const segments: string[] = [];
  if (answers.need) segments.push(`Need: ${answers.need}`);
  if (answers.tools.length) segments.push(`Tools: ${answers.tools.join(", ")}`);
  if (answers.teamSize) segments.push(`Team: ${answers.teamSize}`);
  if (answers.timing) segments.push(`Timing: ${answers.timing}`);
  return segments;
}

/** Characters left for the free-text detail once the chosen answers are counted. */
export function contactDetailLimit(answers: ContactAnswers): number {
  const used = structuredSegments(answers).join("; ").length;
  const separator = used ? 2 : 0;
  return Math.max(0, challengeLimit - used - separator - detailPrefix.length);
}

export function buildContactChallenge(
  answers: ContactAnswers,
): string | undefined {
  const segments = structuredSegments(answers);
  const detail = answers.detail
    .trim()
    .slice(0, contactDetailLimit(answers))
    .trim();
  if (detail) segments.push(`${detailPrefix}${detail}`);
  return segments.length ? segments.join("; ") : undefined;
}

export function prepareContactRequest(
  values: ContactValues,
  submissionId: string,
) {
  return leadSubmissionSchema.safeParse({
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    workEmail: values.workEmail.trim(),
    company: values.company.trim(),
    challenge: buildContactChallenge(values),
    newsletterOptIn: values.newsletterOptIn,
    sourceContext: "contact-page-v3",
    sourcePath: "/contact",
    submissionId,
  });
}
