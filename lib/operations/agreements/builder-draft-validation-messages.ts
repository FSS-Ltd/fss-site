import type { z } from "zod";
import type {
  AgreementBuilderDraftContent,
  AgreementBuilderStep,
} from "./builder-draft-schema";

export type AgreementBuilderValidationIssue = Readonly<{
  step: AgreementBuilderStep;
  message: string;
}>;

const fields: Readonly<
  Record<string, readonly [AgreementBuilderStep, string]>
> = {
  engagementId: ["link", "Choose reviewed work for this agreement."],
  title: ["link", "Enter an agreement title (up to 200 characters)."],
  goals: ["scope", "Complete the client outcome."],
  scope: ["scope", "Complete the deliverables."],
  terms: ["scope", "Complete the boundaries and acceptance terms."],
  responsibilities: ["scope", "Complete the client responsibilities."],
  support: ["scope", "Complete the support arrangements."],
  billingContact: ["people", "Choose a valid billing contact."],
  signatories: [
    "people",
    "Choose between 1 and 10 distinct signers with valid email addresses.",
  ],
  lines: [
    "fees",
    "Add between 1 and 30 complete service items with valid amounts and dates.",
  ],
  installments: ["fees", "Complete the payment amounts and due dates."],
  currency: ["fees", "Choose a supported currency."],
  taxTreatment: ["fees", "Complete the tax treatment."],
  noticeDays: ["fees", "Set notice between 0 and 3650 days."],
  minimumTermMonths: ["fees", "Set the minimum term between 0 and 120 months."],
  requiredDepositPence: ["fees", "Enter a valid deposit amount."],
  assetsRequired: ["fees", "Review whether client assets are required."],
  commercialOffer: [
    "fees",
    "Complete the ongoing compensation options and offer expiry.",
  ],
  spec: ["fees", "Complete the ongoing compensation options."],
  expiresAt: ["fees", "Set a valid offer expiry date."],
};

// Only known schema messages are exposed; unknown keys and input values stay private.
const businessRules: Readonly<Record<string, string>> = {
  "Discount exceeds the line net value.":
    "Reduce the service discount to no more than its net amount.",
  "End date must be on or after start date.":
    "Set the service end date on or after its start date.",
  "Revenue share replaces all ongoing cash charges.":
    "Remove recurring cash charges when using revenue share.",
  "Installments must allocate the exact one-off total including tax.":
    "Make the payment schedule add up to the one-off service total, including tax.",
  "Put installments in due-date order.":
    "Put the payment schedule in due-date order.",
  "Installment must be positive.": "Enter a payment amount greater than zero.",
  "Each signatory must be unique.": "Choose each signer only once.",
};

const stageNames: Readonly<Record<AgreementBuilderStep, string>> = {
  link: "Work",
  scope: "Scope",
  fees: "Fees",
  people: "People",
  document: "Document",
  review: "Review",
};

export function builderValidationIssues(
  issues: readonly z.core.$ZodIssue[],
  content: AgreementBuilderDraftContent,
): readonly AgreementBuilderValidationIssue[] {
  const messages = issues.map((issue): AgreementBuilderValidationIssue => {
    const field = issue.path.find(
      (part) => typeof part === "string" && Object.hasOwn(fields, part),
    );
    const [step, fallback] =
      typeof field === "string"
        ? fields[field]
        : ["review" as const, "Review the agreement details before sending."];
    let message = Object.hasOwn(businessRules, issue.message)
      ? businessRules[issue.message]
      : fallback;
    if (
      issue.code === "custom" &&
      issue.message ===
        "Add a recurring service with the same billing interval and date range, then publish the client-proposed monthly amount."
    ) {
      message = content.agreement?.lines?.some(
        (line) => line.recurrenceMonths > 0,
      )
        ? "Use the same billing interval, start date and end date for all client-proposed recurring services."
        : "Add a recurring service, then publish the client-proposed monthly amount.";
    }
    return { step, message: `${stageNames[step]}: ${message}` };
  });
  return messages.filter(
    (issue, index) =>
      messages.findIndex((other) => other.message === issue.message) === index,
  );
}
