import { randomUUID } from "node:crypto";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createAccountCommandHandler } from "@/lib/growth/campaigns/account-command-route-handler";
import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../runtime";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    return await createAccountCommandHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) =>
        console.error("Outreach account action failed", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
    })(request);
  } catch (error) {
    return messageActionRouteUnavailable(
      "outreach-account",
      error,
      randomUUID(),
    );
  }
}
