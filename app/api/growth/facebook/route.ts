import { randomUUID } from "node:crypto";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createFacebookCommandHandler } from "@/lib/growth/facebook/route-handler";
import { createFacebookReadHandler } from "@/lib/growth/facebook/read-route-handler";
import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../runtime";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    return await createFacebookCommandHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) =>
        console.error("Facebook command failed", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
    })(request);
  } catch (error) {
    return messageActionRouteUnavailable("facebook", error, randomUUID());
  }
}
export async function GET(request: Request): Promise<Response> {
  try {
    return await createFacebookReadHandler({
      db: getGrowthDb(),
      origin: readMessageActionRouteConfig().origin,
      authorizeFounder: requireFounder,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) =>
        console.error("Facebook workspace failed", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
    })(request);
  } catch (error) {
    return messageActionRouteUnavailable("facebook", error, randomUUID());
  }
}
