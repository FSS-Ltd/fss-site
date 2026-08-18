import "server-only";

import type { IntakeSubmissionPayload } from "@/lib/intake/schema";
import { intakeSteps } from "@/lib/intake/schema";
import { renderEmail } from "@/emails/render-email";
import {
  SITE_ENQUIRY_THANK_YOU_SUBJECT,
  SiteEnquiryThankYou,
} from "@/emails/site-enquiry-thank-you";

const FALLBACK_BUSINESS_NAME = "your business";

type IntakeEmailTemplateContext = {
  payload: IntakeSubmissionPayload;
  siteUrl: string;
};

function sanitize(value: string | undefined): string {
  return (value || "").replace(/[<>]/g, "").trim();
}

function formatAnswer(fieldId: string, value: unknown): string {
  for (const step of intakeSteps) {
    const field = step.fields.find((candidate) => candidate.id === fieldId);

    if (!field) {
      continue;
    }

    if (field.type === "select") {
      const option = field.options?.find((candidate) => candidate.id === value);
      return sanitize(option?.label ?? String(value ?? "")) || "N/A";
    }

    return sanitize(typeof value === "string" ? value : "") || "N/A";
  }

  return sanitize(typeof value === "string" ? value : "") || "N/A";
}

export function buildIntakeNotificationEmail(context: IntakeEmailTemplateContext) {
  const { payload, siteUrl } = context;
  const businessSuffix = payload.businessName ? ` (${sanitize(payload.businessName)})` : "";

  const stepsHtml = intakeSteps
    .map((step) => {
      const fieldsHtml = step.fields
        .map((field) => {
          const answer = formatAnswer(field.id, payload[field.id]);
          return `<p><strong>${sanitize(field.label)}:</strong><br />${answer}</p>`;
        })
        .join("\n");

      return `
        <h2>${sanitize(step.title)}</h2>
        ${fieldsHtml}
      `;
    })
    .join("\n");

  return {
    subject: `New idea intake — ${sanitize(payload.firstName)}${businessSuffix}`,
    html: `
      <h1>New Business Idea Intake</h1>
      <p><strong>Email:</strong> ${sanitize(payload.email)}</p>
      <p><strong>Source Path:</strong> ${sanitize(payload.sourcePath)}</p>
      <p><strong>Site:</strong> ${sanitize(siteUrl)}</p>
      <hr />
      ${stepsHtml}
    `,
  };
}

export async function buildIntakeSubmitterConfirmationEmail(
  context: IntakeEmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const { payload } = context;
  const businessName = payload.businessName?.trim() || FALLBACK_BUSINESS_NAME;

  const { html } = await renderEmail({
    templateKey: "site-enquiry-thank-you",
    element: <SiteEnquiryThankYou firstName={payload.firstName} businessName={businessName} />,
  });

  return { subject: SITE_ENQUIRY_THANK_YOU_SUBJECT, html };
}
