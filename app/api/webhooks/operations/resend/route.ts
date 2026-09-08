import { z } from "zod";
import {
  onboardingEnabled,
  getOnboardingWorkerDb,
} from "@/lib/operations/onboarding/worker-db";
import {
  applyOnboardingDeliveryEvent,
  createOnboardingWebhookHandler,
} from "@/lib/operations/onboarding/resend-webhook";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return createOnboardingWebhookHandler({
    enabled: onboardingEnabled(),
    configuration: () => ({
      secret: z
        .string()
        .startsWith("whsec_")
        .parse(process.env.OPERATIONS_RESEND_WEBHOOK_SECRET),
      accountScope: z
        .string()
        .min(1)
        .max(200)
        .parse(process.env.OPERATIONS_RESEND_ACCOUNT_SCOPE),
    }),
    record: (account, event, payload) =>
      applyOnboardingDeliveryEvent(
        getOnboardingWorkerDb(),
        account,
        event,
        payload,
      ),
  })(request);
}
