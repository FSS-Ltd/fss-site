import {
  handleResendWebhook,
  type ResendWebhookDependencies,
  type ResendWebhookHeaders,
} from "@/lib/growth/integrations/resend/webhook";

export type ResendWebhookRouteDependencies = {
  secret: string | undefined;
  deps: ResendWebhookDependencies;
  reportUnexpectedError?: (error: unknown) => void;
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function createResendWebhookRouteHandler(
  dependencies: ResendWebhookRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const rawBody = await request.text();
    const headers: ResendWebhookHeaders = {
      "svix-id": request.headers.get("svix-id"),
      "svix-timestamp": request.headers.get("svix-timestamp"),
      "svix-signature": request.headers.get("svix-signature"),
    };

    try {
      const result = await handleResendWebhook(
        { rawBody, headers, secret: dependencies.secret },
        dependencies.deps,
      );

      if (result.status === "unauthorized") {
        return jsonResponse(401, { ok: false });
      }

      return jsonResponse(200, { ok: true });
    } catch (error) {
      dependencies.reportUnexpectedError?.(error);
      return jsonResponse(500, { ok: false });
    }
  };
}
