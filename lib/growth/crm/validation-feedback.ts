import { z } from "zod";

export type CrmFieldError = { name: string; message: string };
export type CrmFeedback = {
  error: boolean;
  message: string;
  fieldErrors?: CrmFieldError[];
  href?: string;
  refresh?: boolean;
};

const fields: Record<string, { name: string; label: string }> = {
  firstName: { name: "firstName", label: "First name" },
  lastName: { name: "lastName", label: "Last name" },
  email: { name: "email", label: "Email address" },
  sector: { name: "sector", label: "Sector" },
  roleTitle: { name: "roleTitle", label: "Role" },
  recommendedOffer: { name: "recommendedOffer", label: "Recommended offer" },
  opportunitySummary: { name: "opportunitySummary", label: "Opportunity" },
  title: { name: "title", label: "Task title" },
  dueAt: { name: "dueAt", label: "Due date and time" },
  websiteUrl: { name: "websiteUrl", label: "Website URL" },
  tradingName: { name: "tradingName", label: "Trading name" },
  body: { name: "body", label: "Activity details" },
  name: { name: "name", label: "Name" },
  companyNumber: {
    name: "companyNumber",
    label: "Company registration number",
  },
  countryCode: { name: "countryCode", label: "Country" },
  businessName: { name: "businessName", label: "Legal business name" },
  locality: { name: "locality", label: "City" },
  sourceUrl: { name: "sourceUrl", label: "Business source URL" },
  oneOffMinPence: { name: "oneOffMin", label: "One-off minimum" },
  oneOffMaxPence: { name: "oneOffMax", label: "One-off maximum" },
  monthlyPence: { name: "monthly", label: "Monthly amount" },
  oneOffValuePence: { name: "oneOff", label: "One-off amount" },
  monthlyValuePence: { name: "monthly", label: "Monthly amount" },
  expectedCloseDate: { name: "expectedClose", label: "Expected close date" },
  probabilityPercent: { name: "probability", label: "Probability" },
  "contact.sourceUrl": { name: "emailSource", label: "Contact source URL" },
  "contact.verifiedAt": { name: "verifiedAt", label: "Contact checked date" },
  "contact.lawfulBasis": { name: "lawfulBasis", label: "Lawful basis" },
};

function fieldError(issue: z.core.$ZodIssue): CrmFieldError {
  const path = issue.path.map(String).join(".");
  const leaf = String(issue.path.at(-1) ?? "");
  const field = fields[path] ??
    fields[leaf] ?? { name: leaf, label: "This field" };
  let message = issue.message;
  if (issue.code === "too_small" && issue.origin === "string")
    message = `Enter ${field.label.toLowerCase()}.`;
  else if (issue.code === "too_big" && issue.origin === "string")
    message = `Use ${issue.maximum} characters or fewer.`;
  else if (issue.code === "too_small" && issue.origin === "number")
    message = `Enter a number of ${issue.minimum} or more.`;
  else if (issue.code === "too_big" && issue.origin === "number")
    message = `Enter a number of ${issue.maximum} or less.`;
  else if (issue.code === "invalid_type")
    message = "Enter a valid value for this field.";
  else if (issue.code === "invalid_format")
    message =
      issue.format === "url"
        ? "Enter a full web address, such as https://example.com."
        : issue.format === "email"
          ? "Enter an email address, such as name@example.com."
          : "Check this value and try again.";
  return { name: field.name, message };
}

export function crmValidationFeedback(error: unknown): CrmFeedback {
  if (error instanceof z.ZodError) {
    const errors = error.issues.map(fieldError);
    return {
      error: true,
      message: "Check the highlighted fields and try again.",
      fieldErrors: errors.filter(
        (issue, index) =>
          errors.findIndex((other) => other.name === issue.name) === index,
      ),
    };
  }
  return {
    error: true,
    message:
      error instanceof Error
        ? error.message
        : "Check the form fields and try again.",
  };
}
