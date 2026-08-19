import { randomUUID } from "node:crypto";

import { getGrowthDb } from "@/lib/growth/db/client";
import { createProspectStatusTransitionRouteHandler } from "@/lib/growth/prospects/status-transition-route-handler";

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
    const handler = createProspectStatusTransitionRouteHandler(
      "started_talks",
      {
        db: getGrowthDb(),
        config: readMessageActionRouteConfig(),
        createCorrelationId: randomUUID,
        reportUnexpectedError: ({ correlationId, error }) => {
          console.error("Growth OS prospect started-talks action failed.", {
            correlationId,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        },
      },
    );
    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable(
      "prospect-started-talks",
      error,
      randomUUID(),
    );
  }
}
