import "server-only";

import type { LeadCapturePayload } from "@/lib/forms/lead-capture";
import type { ResourceMeta } from "@/lib/types/resource";
import { getDeliveryAction } from "@/lib/resource-delivery";
import { renderEmail } from "@/emails/render-email";
import {
  RESOURCE_DELIVERY_SUBJECT,
  ResourceDelivery,
} from "@/emails/resource-delivery";
import {
  SITE_ENQUIRY_THANK_YOU_SUBJECT,
  SiteEnquiryThankYou,
} from "@/emails/site-enquiry-thank-you";

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

export async function buildSubmitterConfirmationEmail(
  context: LeadEmailTemplateContext,
): Promise<{ subject: string; html: string }> {
  const { payload, siteUrl, resource } = context;
  const deliveryAction = resource ? getDeliveryAction(resource) : null;

  if (resource && deliveryAction) {
    const resourceUrl = new URL(deliveryAction.href, siteUrl).toString();
    const { html } = await renderEmail({
      templateKey: "resource-delivery",
      element: (
        <ResourceDelivery
          firstName={payload.firstName}
          resourceTitle={resource.title}
          resourceUrl={resourceUrl}
        />
      ),
    });
    return { subject: RESOURCE_DELIVERY_SUBJECT, html };
  }

  const { html } = await renderEmail({
    templateKey: "site-enquiry-thank-you",
    element: <SiteEnquiryThankYou firstName={payload.firstName} businessName={payload.company} />,
  });
  return { subject: SITE_ENQUIRY_THANK_YOU_SUBJECT, html };
}
