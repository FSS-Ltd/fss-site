import { appendAuditEvent } from "@/lib/growth/audit/service";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createPostgresResendWebhookRepository } from "@/lib/growth/integrations/resend/webhook-repository";
import {
  handleResendWebhook,
  type ResendWebhookDependencies,
  type ResendWebhookHeaders,
} from "@/lib/growth/integrations/resend/webhook";
import { createNewsletterSubscriberRepository, upsertSuppressedStatus } from "@/lib/growth/newsletter/subscribers-repository";
import { postgresNewsletterDispatchRepository } from "@/lib/growth/newsletter/newsletter-dispatch-repository";
import { stopSequence } from "@/lib/growth/sequences/stop";

export const runtime = "nodejs";

export type ResendWebhookRouteDependencies = {
  secret: string | undefined;
  deps: ResendWebhookDependencies;
  reportUnexpectedError?: (error: unknown) => void;
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function createResendWebhookRouteHandler(
  dependencies: ResendWebhookRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    // Raw text first, before any JSON parsing, so signature verification
    // sees exactly the bytes Resend signed.
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
        // Generic body: never reveal whether the secret was missing or the
        // signature was invalid (same fail-closed principle as cron-auth.ts).
        return jsonResponse(401, { ok: false });
      }

      // "invalid_payload" (an event shape we don't recognise) still
      // acknowledges with 200 — Resend retries on non-2xx, and retrying a
      // payload our parser will never accept just produces a retry storm.
      return jsonResponse(200, { ok: true });
    } catch (error) {
      dependencies.reportUnexpectedError?.(error);
      return jsonResponse(500, { ok: false });
    }
  };
}

export async function POST(request: Request): Promise<Response> {
  const env = readGrowthServerEnv();
  const db = getGrowthDb();
  const subscribers = createNewsletterSubscriberRepository(db);

  const handler = createResendWebhookRouteHandler({
    secret: env.resendWebhookSecret,
    deps: {
      repository: createPostgresResendWebhookRepository(db),
      suppression: {
        findSubscriberStatusByEmail: async (normalisedEmail) => {
          const record = await subscribers.findSubscriberByEmail(normalisedEmail);
          return record ? { status: record.status } : null;
        },
        upsertSuppressedStatus: (normalisedEmail, status, at) =>
          upsertSuppressedStatus(db, normalisedEmail, status, at),
      },
      cancelQueuedSendsForEmail: (normalisedEmail, errorCode) =>
        postgresNewsletterDispatchRepository.cancelQueuedSendsForEmail(db, normalisedEmail, errorCode),
      stopSequence: (input) => stopSequence(db, input),
      appendAuditEvent: (input) => appendAuditEvent(db, input),
    },
    reportUnexpectedError: (error) => {
      console.error("Growth OS resend webhook failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
