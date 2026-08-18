import { randomUUID } from "node:crypto";

import { getGrowthDb } from "@/lib/growth/db/client";
import { createNeedsRedraftHandler } from "@/lib/growth/sequences/needs-redraft-route-handler";

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
    const handler = createNeedsRedraftHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS needs-redraft action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    });
    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable("needs-redraft", error, randomUUID());
  }
}
