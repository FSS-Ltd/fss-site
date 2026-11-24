import { randomUUID } from "node:crypto";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createFounderVerificationHandler } from "@/lib/growth/campaigns/founder-verification-route-handler";
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
    return await createFounderVerificationHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) =>
        console.error("Founder evidence verification failed", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
    })(request, context);
  } catch (error) {
    return messageActionRouteUnavailable("verify-source", error, randomUUID());
  }
}
