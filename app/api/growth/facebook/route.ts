import { randomUUID } from "node:crypto";
import {
  requireFounder,
  FounderAuthorizationError,
} from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createFacebookCommandHandler } from "@/lib/growth/facebook/route-handler";
import { getFacebookWorkspace } from "@/lib/growth/facebook/workspace";
import {
  createApiErrorResponse,
  createJsonResponse,
} from "@/lib/growth/http/api-error";
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
  const correlationId = randomUUID();
  try {
    const founder = await requireFounder();
    const cursor = new URL(request.url).searchParams.get("cursor");
    if (
      cursor !== null &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        cursor,
      )
    )
      return createApiErrorResponse(
        422,
        "invalid_cursor",
        "Invalid destination cursor.",
        correlationId,
      );
    const result = await getFacebookWorkspace(
      getGrowthDb(),
      founder,
      new Date(),
      correlationId,
      cursor,
    );
    return createJsonResponse(result, result.status === "ready" ? 200 : 503);
  } catch (error) {
    if (error instanceof FounderAuthorizationError)
      return createApiErrorResponse(
        401,
        "unauthorized",
        "Founder authorization is required.",
        correlationId,
      );
    return messageActionRouteUnavailable("facebook", error, correlationId);
  }
}
