import "server-only";

import type { LeadCapturePayload } from "@/lib/forms/lead-capture";

import { getDeliveryAction } from "@/lib/resource-delivery";
import { getResourceBySlug } from "@/lib/resources";
import { getLeadServerEnv } from "@/lib/server/env";
import {
  buildInternalLeadNotificationEmail,
  buildSubmitterConfirmationEmail,
} from "@/lib/server/lead-email-templates";
import { sendResendEmail } from "@/lib/server/resend";
import { upsertLeadInHubSpot } from "@/lib/server/hubspot";
import { getGrowthDb } from "@/lib/growth/db/client";
import { submitLeadInTransaction } from "@/lib/growth/inbound/submit-lead";
import { createResendClient } from "@/lib/growth/integrations/resend/client";

type LeadSubmissionServiceResult = {
  ok: boolean;
  leadId?: string;
  errorMessage?: string;
  emailWarning?: boolean;
};

export async function processLeadSubmission(
  payload: LeadCapturePayload,
): Promise<LeadSubmissionServiceResult> {
  const env = getLeadServerEnv();
  const resource = payload.resourceSlug ? await getResourceBySlug(payload.resourceSlug) : null;
  const deliveryAction = resource ? getDeliveryAction(resource.meta) : null;
  const submissionType = resource && deliveryAction ? "resource_request" : "site_enquiry";

  let leadId: string;
  try {
    const submission = await submitLeadInTransaction(
      {
        submissionId: payload.submissionId,
        submissionType,
        firstName: payload.firstName,
        lastName: payload.lastName,
        workEmail: payload.workEmail,
        businessName: payload.company,
        challenge: payload.challenge,
        sourcePath: payload.sourcePath,
        sourceContext: payload.sourceContext,
        resourceSlug: payload.resourceSlug,
        newsletterOptIn: payload.newsletterOptIn ?? false,
      },
      getGrowthDb(),
    );
    leadId = submission.leadId;
  } catch (error) {
    console.error("Lead submission failed to persist.", {
      sourceContext: payload.sourceContext,
      sourcePath: payload.sourcePath,
      resourceSlug: payload.resourceSlug,
      error,
    });

    return {
      ok: false,
      errorMessage: "We could not submit your request right now. Please try again shortly.",
    };
  }

  const internalEmail = buildInternalLeadNotificationEmail({
    payload,
    siteUrl: env.siteUrl,
    resource: resource?.meta ?? null,
  });
  const submitterEmail = await buildSubmitterConfirmationEmail({
    payload,
    siteUrl: env.siteUrl,
    resource: resource?.meta ?? null,
  });

  const emailResults = await Promise.allSettled([
    sendResendEmail({
      apiKey: env.resendApiKey,
      from: env.resendFromEmail,
      to: env.leadNotificationEmail,
      subject: internalEmail.subject,
      html: internalEmail.html,
      replyTo: env.resendReplyToEmail,
    }),
    createResendClient(env.resendApiKey).send({
      idempotencyKey: payload.submissionId,
      category: submitterEmail.category,
      from: env.resendFromEmail,
      to: payload.workEmail,
      replyTo: env.resendReplyToEmail,
      subject: submitterEmail.subject,
      html: submitterEmail.html,
      text: submitterEmail.text,
    }),
  ]);

  const hasEmailFailure = emailResults.some((result) => result.status === "rejected");
  if (hasEmailFailure) {
    console.error("Lead submission: lead was saved but one or more emails failed.", {
      leadId,
      sourceContext: payload.sourceContext,
      sourcePath: payload.sourcePath,
      resourceSlug: payload.resourceSlug,
    });
  }

  const hasCustomHubSpotMapping =
    Boolean(env.hubspotChallengeProperty) &&
    Boolean(env.hubspotSourceContextProperty) &&
    Boolean(env.hubspotSourcePathProperty) &&
    Boolean(env.hubspotResourceSlugProperty);

  if (!hasCustomHubSpotMapping) {
    console.warn(
      "HubSpot custom property mapping is incomplete. Extra lead context will not be written to HubSpot contact properties.",
    );
  }

  try {
    await upsertLeadInHubSpot(payload, {
      accessToken: env.hubspotAccessToken,
      challengeProperty: env.hubspotChallengeProperty,
      sourceContextProperty: env.hubspotSourceContextProperty,
      sourcePathProperty: env.hubspotSourcePathProperty,
      resourceSlugProperty: env.hubspotResourceSlugProperty,
    });
  } catch (error) {
    console.error("Lead submission: HubSpot sync failed. The local lead is unaffected.", {
      leadId,
      sourceContext: payload.sourceContext,
      sourcePath: payload.sourcePath,
      resourceSlug: payload.resourceSlug,
      error,
    });
  }

  return { ok: true, leadId, emailWarning: hasEmailFailure };
}
