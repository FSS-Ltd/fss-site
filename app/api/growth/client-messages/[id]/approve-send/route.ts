import { randomUUID } from "node:crypto";

import { z } from "zod";

import { requireFounder } from "@/lib/growth/auth/require-founder";
import {
  ClientThankYouError,
  createClientThankYouSender,
  createPostgresClientThankYouDependencies,
  type ClientThankYouErrorCode,
} from "@/lib/growth/clients/client-thank-you";
import { readGrowthServerEnv, requireResendEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createResendClient } from "@/lib/growth/integrations/resend/client";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
} from "@/lib/growth/sequences/message-action-route";

import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../../../runtime";

export const runtime = "nodejs";

const bodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  includeNewsletterInvite: z.boolean(),
});

const ERROR_MAPPING: Record<ClientThankYouErrorCode, MessageActionErrorMapping> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The client message was not found.",
  },
  not_approvable: {
    status: 409,
    code: "not_approvable",
    message: "This message has already been sent.",
  },
  not_testable: {
    status: 409,
    code: "not_testable",
    message: "This message has already been sent.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "This message changed since you loaded it. Refresh and try again.",
  },
  suppressed_contact: {
    status: 422,
    code: "suppressed_contact",
    message: "This contact is suppressed and cannot be emailed.",
  },
  send_failed: {
    status: 502,
    code: "send_failed",
    message: "Resend did not confirm the send.",
  },
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const db = getGrowthDb();
    const env = readGrowthServerEnv();
    const resendEnv = requireResendEnv(env);
    const resend = createResendClient(resendEnv.apiKey);

    const approveAndSend = createClientThankYouSender({
      repository: createPostgresClientThankYouDependencies(db),
      resend,
      fromEmail: resendEnv.from,
    });

    const handler = createMessageActionHandler({
      config: readMessageActionRouteConfig(),
      authorizeFounder: requireFounder,
      bodySchema,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS client-message approve-send action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
      action: ({ draftTaskId: messageId, founder, correlationId, body }) =>
        approveAndSend(db, {
          messageId,
          expectedVersion: body.expectedVersion,
          includeNewsletterInvite: body.includeNewsletterInvite,
          founder,
          correlationId,
        }),
      mapActionError: (error) =>
        error instanceof ClientThankYouError ? ERROR_MAPPING[error.code] : null,
    });

    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable(
      "client-message-approve-send",
      error,
      randomUUID(),
    );
  }
}
