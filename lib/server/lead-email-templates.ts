import "server-only";

import type { LeadCapturePayload } from "@/lib/forms/lead-capture";
import type { ResourceMeta } from "@/lib/types/resource";
import { getDeliveryAction, getDeliveryNextStep } from "@/lib/resource-delivery";

type LeadEmailTemplateContext = {
  payload: LeadCapturePayload;
  siteUrl: string;
  resource?: ResourceMeta | null;
};

function sanitize(value: string | undefined): string {
  return (value || "").replace(/[<>]/g, "").trim();
}

export function buildInternalLeadNotificationEmail(context: LeadEmailTemplateContext) {
  const { payload, siteUrl, resource } = context;

  return {
    subject: `New lead: ${payload.firstName} ${payload.lastName}`,
    html: `
      <h1>New Lead Submission</h1>
      <p><strong>Name:</strong> ${sanitize(payload.firstName)} ${sanitize(payload.lastName)}</p>
      <p><strong>Email:</strong> ${sanitize(payload.workEmail)}</p>
      <p><strong>Company:</strong> ${sanitize(payload.company)}</p>
      <p><strong>Challenge:</strong> ${sanitize(payload.challenge) || "N/A"}</p>
      <p><strong>Source Context:</strong> ${sanitize(payload.sourceContext)}</p>
      <p><strong>Source Path:</strong> ${sanitize(payload.sourcePath)}</p>
      <p><strong>Resource Slug:</strong> ${sanitize(payload.resourceSlug) || "N/A"}</p>
      <p><strong>Resource Title:</strong> ${sanitize(resource?.title) || "N/A"}</p>
      <p><strong>Resource Delivery Type:</strong> ${sanitize(resource?.delivery.type) || "N/A"}</p>
      <p><strong>Site:</strong> ${sanitize(siteUrl)}</p>
    `,
  };
}

export function buildSubmitterConfirmationEmail(context: LeadEmailTemplateContext) {
  const { payload, siteUrl, resource } = context;
  const resourceNote = payload.resourceSlug
    ? `We received your request for <strong>${sanitize(resource?.title ?? payload.resourceSlug)}</strong>.`
    : "We received your request and our team will follow up shortly.";
  const deliveryAction = resource ? getDeliveryAction(resource) : null;
  const deliveryBlock =
    resource && deliveryAction
      ? `
      <p>${sanitize(getDeliveryNextStep(resource))}</p>
      <p><a href="${sanitize(siteUrl + deliveryAction.href)}">${sanitize(deliveryAction.label)}</a></p>
    `
      : "";
  const fallbackDeliveryBlock =
    resource && !deliveryAction
      ? `<p>${sanitize(getDeliveryNextStep(resource))}</p>`
      : "";

  return {
    subject: "We received your request",
    html: `
      <h1>Thanks for reaching out to FSS</h1>
      <p>Hi ${sanitize(payload.firstName)},</p>
      <p>${resourceNote}</p>
      ${deliveryBlock}
      ${fallbackDeliveryBlock}
      <p>If needed, you can continue exploring resources here: <a href="${sanitize(siteUrl)}/resources">Resources</a>.</p>
      <p>- FSS Team</p>
    `,
  };
}
