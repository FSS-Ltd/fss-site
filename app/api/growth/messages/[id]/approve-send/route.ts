import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createApproveSendHandler } from "@/lib/growth/sequences/approve-send-route-handler";

import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../../../runtime";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const handler = createApproveSendHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      founderEmail: readGrowthServerEnv().ownerEmail,
      siteOrigin: readMessageActionRouteConfig().origin,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS approve-send action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    });
    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable("approve-send", error, randomUUID());
  }
}
