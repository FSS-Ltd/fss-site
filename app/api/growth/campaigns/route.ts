import { randomUUID } from "node:crypto";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createCampaignCommandHandler } from "@/lib/growth/campaigns/command-route-handler";
import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../runtime";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    return await createCampaignCommandHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) =>
        console.error("Campaign command failed", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
    })(request);
  } catch (error) {
    return messageActionRouteUnavailable("campaign", error, randomUUID());
  }
}
