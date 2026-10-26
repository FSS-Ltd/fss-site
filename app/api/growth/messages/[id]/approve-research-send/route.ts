import { randomUUID } from "node:crypto";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createResearchEmailSendHandler } from "@/lib/growth/sequences/research-email-send-route";
import {
  messageActionRouteUnavailable,
  readGmailDraftRouteExtras,
  readMessageActionRouteConfig,
} from "../../../runtime";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    return createResearchEmailSendHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      founderEmail: readGrowthServerEnv().ownerEmail,
      ...readGmailDraftRouteExtras(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS research email approval failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    })(request, context);
  } catch (error) {
    return messageActionRouteUnavailable(
      "approve-research-send",
      error,
      randomUUID(),
    );
  }
}
