import { z } from "zod";
import {
  onboardingEnabled,
  getOnboardingWorkerDb,
} from "@/lib/operations/onboarding/worker-db";
import {
  applyOnboardingDeliveryEvent,
  createOnboardingWebhookHandler,
} from "@/lib/operations/onboarding/resend-webhook";
import { applyAgreementDeliveryEvent } from "@/lib/operations/agreements/agreement-delivery-webhook";
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
    record: async (account, event, payload) => {
      const db = getOnboardingWorkerDb();
      await applyOnboardingDeliveryEvent(db, account, event, payload);
      await applyAgreementDeliveryEvent(db, event, payload);
    },
  })(request);
}
