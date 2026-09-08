import { randomUUID } from "node:crypto";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import { recordBillingEvent } from "@/lib/operations/billing/events";
import { getBillingWorkerDb } from "@/lib/operations/billing/worker-db";
import { createBillingWebhookHandler } from "@/lib/operations/http/billing-webhook-handler";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return createBillingWebhookHandler({
    enabled:
      process.env.OPERATIONS_ENABLED === "true" &&
      process.env.OPERATIONS_BILLING_ENABLED === "true",
    createCorrelationId: randomUUID,
    configuration: () => {
      const billing = readBillingConfiguration();
      const secret = process.env.OPERATIONS_STRIPE_WEBHOOK_SECRET;
      if (!billing.enabled || !secret || !/^whsec_[A-Za-z0-9]+$/.test(secret))
        throw new Error("Operations webhook is not configured.");
      return { accountId: billing.accountId, mode: billing.mode, secret };
    },
    record: (receipt) => recordBillingEvent(getBillingWorkerDb(), receipt),
    reportUnexpectedError: (report) =>
      console.error("Operations webhook receipt failed.", report),
  })(request);
}
