import {
  PayloadTooLargeError,
  readRawBody,
} from "@/lib/growth/integrations/read-raw-body";
import { extractResendDeliveryCandidate } from "@/lib/growth/integrations/resend/outreach-delivery-evidence";
import {
  verifyResendWebhookSignature,
  type ResendWebhookHeaders,
} from "@/lib/growth/integrations/resend/webhook";
import type { ResendBinding } from "@/lib/growth/campaigns/resend-account-readiness";
import type { ResendReceipt } from "@/lib/growth/campaigns/resend-confirmation";
import type { ReservationOutcome } from "@/lib/growth/campaigns/reservation-shared";

const MAX_BODY_BYTES = 1_048_576;
type Configuration = { binding: ResendBinding; webhookSecret: string };
type Dependencies = {
  readConfiguration: () => Configuration | null;
  resolveConnection: (binding: ResendBinding) => Promise<string | null>;
  confirm: (
    config: Configuration,
    connectionId: string,
    rawBody: string,
    headers: ResendWebhookHeaders,
  ) => Promise<
    ReservationOutcome<{
      reservationId: string;
      receipt: ResendReceipt;
      replay: boolean;
    }>
  >;
  reportUnexpectedError?: (error: unknown) => void;
};
function response(status: number, code: string): Response {
  return Response.json(
    { ok: status === 200, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** Scoped deliveries only. This endpoint never invokes the newsletter webhook. */
export function createResendOutreachWebhookHandler(
  deps: Dependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const bytes = await readRawBody(request, MAX_BODY_BYTES);
      let rawBody: string;
      try {
        rawBody = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes);
      } catch {
        return response(400, "invalid_body");
      }
      const config = deps.readConfiguration();
      if (!config?.webhookSecret || !config.binding.webhookGeneration)
        return response(503, "configuration_unavailable");
      const headers: ResendWebhookHeaders = {
        "svix-id": request.headers.get("svix-id"),
        "svix-timestamp": request.headers.get("svix-timestamp"),
        "svix-signature": request.headers.get("svix-signature"),
      };
      const verified = verifyResendWebhookSignature(
        rawBody,
        headers,
        config.webhookSecret,
      );
      if (!verified.ok) return response(401, "unauthorized");
      if (
        !verified.payload ||
        typeof verified.payload !== "object" ||
        !("type" in verified.payload) ||
        verified.payload.type !== "email.delivered"
      )
        return response(422, "unsupported_event");
      const connectionId = await deps.resolveConnection(config.binding);
      if (!connectionId) return response(503, "account_unavailable");
      const candidate = extractResendDeliveryCandidate({
        verified,
        binding: {
          connectionId,
          team: config.binding.team,
          environment: config.binding.environment,
          sender: config.binding.sender,
          webhookGeneration: config.binding.webhookGeneration,
        },
      });
      if (!candidate) return response(422, "invalid_delivery");
      const result = await deps.confirm(config, connectionId, rawBody, headers);
      if (result.status === "ready") return response(200, "recorded");
      if (["issuer_unknown", "webhook_binding_unknown"].includes(result.reason))
        return response(503, "receipt_pending");
      return response(409, "receipt_conflict");
    } catch (error) {
      if (error instanceof PayloadTooLargeError)
        return response(413, "payload_too_large");
      deps.reportUnexpectedError?.(error);
      return response(503, "temporarily_unavailable");
    }
  };
}
