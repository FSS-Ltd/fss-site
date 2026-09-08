import type { BillingEventReceipt } from "../billing/events";
import type { BillingMode } from "../billing/types";
import { verifyBillingWebhook } from "../billing/webhook";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "../auth/http";

export const MAX_BILLING_WEBHOOK_BYTES = 1024 * 1024;
class WebhookBodyTooLarge extends Error {}
async function readWebhookBytes(request: Request): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > MAX_BILLING_WEBHOOK_BYTES)
    throw new WebhookBodyTooLarge();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > MAX_BILLING_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new WebhookBodyTooLarge();
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}
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
      const raw = await readWebhookBytes(request);
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
