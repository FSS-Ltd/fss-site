import { randomUUID } from "node:crypto";

import { getGrowthDb } from "@/lib/growth/db/client";
import { createResumeRouteHandler } from "@/lib/growth/sequences/resume-route-handler";

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
    const handler = createResumeRouteHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS resume action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    });
    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable("resume", error, randomUUID());
  }
}
