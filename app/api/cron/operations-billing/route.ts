import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { createOperationsBillingClient } from "@/lib/operations/billing/client";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import {
  runBillingEventWorker,
  reconcileDailyBilling,
} from "@/lib/operations/billing/reconciliation";
import { createStripeReconciliationProvider } from "@/lib/operations/billing/stripe-reconciliation";
import { getBillingWorkerDb } from "@/lib/operations/billing/worker-db";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: process.env.CRON_SECRET,
      automationsEnabled:
        process.env.OPERATIONS_ENABLED === "true" &&
        process.env.OPERATIONS_BILLING_ENABLED === "true",
      disabledReason: "operations_billing_disabled",
      reportUnexpectedError: () =>
        console.error("Operations billing reconciliation failed."),
    },
    async () => {
      const configuration = readBillingConfiguration();
      const client = await createOperationsBillingClient();
      if (!configuration.enabled || !client)
        throw new Error("Billing is disabled.");
      const scope = {
        accountId: configuration.accountId,
        mode: configuration.mode,
      };
      const provider = createStripeReconciliationProvider(client, scope);
      const db = getBillingWorkerDb();
      const events = await runBillingEventWorker(db, provider, scope, {
        limit: 5,
        budgetMs: 40000,
      });
      const reconciliation = await reconcileDailyBilling(db, provider, scope, {
        limit: 5,
      });
      return { events, reconciliation };
    },
  )(request);
}
