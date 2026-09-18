import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import {
  onboardingEnabled,
  getOnboardingWorkerDb,
} from "@/lib/operations/onboarding/worker-db";
import { onboardingStore } from "@/lib/operations/onboarding/outbox";
import { onboardingEffects } from "@/lib/operations/onboarding/effects";
import { runOnboardingWorker } from "@/lib/operations/onboarding/worker";
import { dispatchRequestNotifications } from "@/lib/operations/requests/notifications";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request): Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: process.env.CRON_SECRET,
      automationsEnabled: onboardingEnabled(),
      disabledReason: "operations_onboarding_disabled",
      reportUnexpectedError: (report) =>
        console.error("Operations onboarding dispatch failed.", report),
    },
    async () => {
      const db = getOnboardingWorkerDb();
      const onboarding = await runOnboardingWorker(
        onboardingStore(db),
        onboardingEffects(db),
        {
          limit: 5,
        },
      );
      const requestEmails = process.env.OPERATIONS_REQUEST_EMAILS_ENABLED
        ? await dispatchRequestNotifications(db, {
            resendApiKey: process.env.OPERATIONS_RESEND_API_KEY,
          }).catch((error: unknown) => {
            console.error("Request notification dispatch failed.", error);
            return {
              fannedOut: 0,
              emailsClaimed: 0,
              emailsSent: 0,
              emailsHeld: 0,
            };
          })
        : { fannedOut: 0, emailsClaimed: 0, emailsSent: 0, emailsHeld: 0 };
      return { onboarding, requestEmails };
    },
  )(request);
}
