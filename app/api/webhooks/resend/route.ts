import { appendAuditEvent } from "@/lib/growth/audit/service";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createPostgresResendWebhookRepository } from "@/lib/growth/integrations/resend/webhook-repository";
import {
  createNewsletterSubscriberRepository,
  upsertSuppressedStatus,
} from "@/lib/growth/newsletter/subscribers-repository";
import { postgresNewsletterDispatchRepository } from "@/lib/growth/newsletter/newsletter-dispatch-repository";
import { stopSequence } from "@/lib/growth/sequences/stop";

import { createResendWebhookRouteHandler } from "./handler";

export const runtime = "nodejs";

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
          const record =
            await subscribers.findSubscriberByEmail(normalisedEmail);
          return record ? { status: record.status } : null;
        },
        upsertSuppressedStatus: (normalisedEmail, status, at) =>
          upsertSuppressedStatus(db, normalisedEmail, status, at),
      },
      cancelQueuedSendsForEmail: (normalisedEmail, errorCode) =>
        postgresNewsletterDispatchRepository.cancelQueuedSendsForEmail(
          db,
          normalisedEmail,
          errorCode,
        ),
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
