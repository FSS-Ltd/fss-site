import { randomUUID } from "node:crypto";

import { z } from "zod";

import { requireFounder } from "@/lib/growth/auth/require-founder";
import { readGrowthServerEnv, requireResendEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createResendClient } from "@/lib/growth/integrations/resend/client";
import {
  createFounderTestSender,
  createPostgresNewsletterIssueDependencies,
  NewsletterIssueError,
  type NewsletterIssueErrorCode,
} from "@/lib/growth/newsletter/issues";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
} from "@/lib/growth/sequences/message-action-route";

import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../../../runtime";

export const runtime = "nodejs";

const bodySchema = z.object({});

const ERROR_MAPPING: Record<NewsletterIssueErrorCode, MessageActionErrorMapping> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The newsletter issue was not found.",
  },
  not_testable: {
    status: 409,
    code: "not_testable",
    message: "This newsletter issue can no longer be test sent.",
  },
  send_failed: {
    status: 502,
    code: "send_failed",
    message: "Resend did not confirm the test send.",
  },
  invalid_transition: {
    status: 409,
    code: "invalid_transition",
    message: "This newsletter issue cannot make that transition.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "The newsletter issue has changed. Reload and try again.",
  },
  checksum_mismatch: {
    status: 409,
    code: "checksum_mismatch",
    message: "The approved content no longer matches the current snapshot.",
  },
  test_not_sent: {
    status: 422,
    code: "test_not_sent",
    message: "Send a founder test of the current version before scheduling.",
  },
  missing_consent: {
    status: 422,
    code: "missing_consent",
    message: "There are no currently consented recipients to send to.",
  },
  missing_unsubscribe_link: {
    status: 422,
    code: "missing_unsubscribe_link",
    message: "The rendered snapshot has no unsubscribe link.",
  },
  invalid_schedule_time: {
    status: 422,
    code: "invalid_schedule_time",
    message: "The schedule time must be in the future.",
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

    const sendFounderTest = createFounderTestSender({
      repository: createPostgresNewsletterIssueDependencies(db),
      resend,
      fromEmail: resendEnv.from,
      founderEmail: env.ownerEmail,
    });

    const handler = createMessageActionHandler({
      config: readMessageActionRouteConfig(),
      authorizeFounder: requireFounder,
      bodySchema,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS newsletter send-test action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
      action: ({ draftTaskId, founder, correlationId }) =>
        sendFounderTest(db, { issueId: draftTaskId, founder, correlationId }),
      mapActionError: (error) =>
        error instanceof NewsletterIssueError ? ERROR_MAPPING[error.code] : null,
    });

    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable(
      "newsletter-send-test",
      error,
      randomUUID(),
    );
  }
}
