import "server-only";

import type { IntakeSubmissionPayload } from "@/lib/intake/schema";
import { intakeSteps } from "@/lib/intake/schema";

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

export function buildIntakeSubmitterConfirmationEmail(context: IntakeEmailTemplateContext) {
  const { payload, siteUrl } = context;

  return {
    subject: "We received your idea",
    html: `
      <h1>Thanks for sharing your idea with FSS</h1>
      <p>Hi ${sanitize(payload.firstName)},</p>
      <p>We received your submission and will review it shortly.</p>
      <p>- FSS Team</p>
      <p><a href="${sanitize(siteUrl)}">${sanitize(siteUrl)}</a></p>
    `,
  };
}
