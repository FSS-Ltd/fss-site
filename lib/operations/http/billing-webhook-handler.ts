import type { BillingEventReceipt } from "../billing/events";
import type { BillingMode } from "../billing/types";
import { verifyBillingWebhook } from "../billing/webhook";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "../auth/http";

export const MAX_BILLING_WEBHOOK_BYTES = 1024 * 1024;
import { readWebhookBytes, WebhookBodyTooLarge } from "./webhook-body";
export type BillingWebhookDependencies = Pick<
  PortalAuthHandlerDependencies,
  "enabled" | "createCorrelationId" | "reportUnexpectedError"
> & {
  configuration: () => { accountId: string; mode: BillingMode; secret: string };
  record: (receipt: BillingEventReceipt) => Promise<"recorded" | "duplicate">;
};
export function createBillingWebhookHandler(
  deps: BillingWebhookDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const reply = (status: number, ok: boolean) =>
      Response.json(
        { ok },
        { status, headers: privateAuthHeaders(correlationId) },
      );
    if (!deps.enabled) return reply(404, false);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply(415, false);
    try {
      const config = deps.configuration();
      const raw = await readWebhookBytes(request, MAX_BILLING_WEBHOOK_BYTES);
      const receipt = verifyBillingWebhook(
        raw,
        request.headers.get("stripe-signature"),
        config,
      );
      if (!receipt) return reply(400, false);
      const result = await deps.record(receipt);
      return reply(result === "recorded" ? 202 : 200, true);
    } catch (error) {
      if (error instanceof WebhookBodyTooLarge) return reply(413, false);
      reportAuthError(deps, correlationId, error);
      return reply(503, false);
    }
  };
}
