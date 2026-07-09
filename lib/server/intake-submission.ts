import "server-only";

import type { IntakeSubmissionPayload } from "@/lib/intake/schema";

import { getIntakeServerEnv } from "@/lib/server/env";
import {
  buildIntakeNotificationEmail,
  buildIntakeSubmitterConfirmationEmail,
} from "@/lib/server/intake-email-template";
import { sendResendEmail } from "@/lib/server/resend";

type IntakeSubmissionServiceResult = {
  ok: boolean;
  errorMessage?: string;
};

export async function processIntakeSubmission(
  payload: IntakeSubmissionPayload,
): Promise<IntakeSubmissionServiceResult> {
  if (payload.botField) {
    return { ok: true };
  }

  const env = getIntakeServerEnv();

  try {
    const internalEmail = buildIntakeNotificationEmail({ payload, siteUrl: env.siteUrl });
    const submitterEmail = buildIntakeSubmitterConfirmationEmail({
      payload,
      siteUrl: env.siteUrl,
    });

    const emailResults = await Promise.allSettled([
      sendResendEmail({
        apiKey: env.resendApiKey,
        from: env.resendFromEmail,
        to: env.leadNotificationEmail,
        subject: internalEmail.subject,
        html: internalEmail.html,
        replyTo: payload.email,
      }),
      sendResendEmail({
        apiKey: env.resendApiKey,
        from: env.resendFromEmail,
        to: payload.email,
        subject: submitterEmail.subject,
        html: submitterEmail.html,
        replyTo: env.resendReplyToEmail,
      }),
    ]);

    const internalEmailResult = emailResults[0];

    if (internalEmailResult.status === "rejected") {
      console.error("Intake submission: internal notification email failed.", {
        sourcePath: payload.sourcePath,
        error: internalEmailResult.reason,
      });

      return {
        ok: false,
        errorMessage: "We could not submit your idea right now. Please try again shortly.",
      };
    }

    if (emailResults[1].status === "rejected") {
      console.error("Intake submission: submitter confirmation email failed.", {
        sourcePath: payload.sourcePath,
        error: emailResults[1].reason,
      });
    }

    return { ok: true };
  } catch (error) {
    console.error("Intake submission failed.", {
      sourcePath: payload.sourcePath,
      error,
    });

    return {
      ok: false,
      errorMessage: "We could not submit your idea right now. Please try again shortly.",
    };
  }
}
