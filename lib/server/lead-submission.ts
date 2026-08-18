import "server-only";

import type { LeadCapturePayload } from "@/lib/forms/lead-capture";

import { getResourceBySlug } from "@/lib/resources";
import { getLeadServerEnv } from "@/lib/server/env";
import {
  buildInternalLeadNotificationEmail,
  buildSubmitterConfirmationEmail,
} from "@/lib/server/lead-email-templates";
import { sendResendEmail } from "@/lib/server/resend";
import { upsertLeadInHubSpot } from "@/lib/server/hubspot";

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
    const hubspotResult = await upsertLeadInHubSpot(payload, {
      accessToken: env.hubspotAccessToken,
      challengeProperty: env.hubspotChallengeProperty,
      sourceContextProperty: env.hubspotSourceContextProperty,
      sourcePathProperty: env.hubspotSourcePathProperty,
      resourceSlugProperty: env.hubspotResourceSlugProperty,
    });

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
      sendResendEmail({
        apiKey: env.resendApiKey,
        from: env.resendFromEmail,
        to: payload.workEmail,
        subject: submitterEmail.subject,
        html: submitterEmail.html,
        replyTo: env.resendReplyToEmail,
      }),
    ]);

    const hasEmailFailure = emailResults.some((result) => result.status === "rejected");

    if (hasEmailFailure) {
      console.error("Lead submission: HubSpot succeeded but one or more emails failed.", {
        sourceContext: payload.sourceContext,
        sourcePath: payload.sourcePath,
        resourceSlug: payload.resourceSlug,
      });
    }

    return {
      ok: true,
      leadId: hubspotResult.contactId,
      emailWarning: hasEmailFailure,
    };
  } catch (error) {
    console.error("Lead submission failed.", {
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
}
