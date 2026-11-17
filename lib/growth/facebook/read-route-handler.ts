import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createApiErrorResponse, createJsonResponse } from "../http/api-error";
import { readRequestHasRegisteredOrigin } from "../http/founder-request";
import { getFacebookWorkspace } from "./workspace";

type Dependencies = {
  db: GrowthDb;
  origin: string;
  authorizeFounder: () => Promise<FounderSession>;
  read?: typeof getFacebookWorkspace;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};
export function createFacebookReadHandler(
  dependencies: Dependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    if (!readRequestHasRegisteredOrigin(request, dependencies.origin))
      return createApiErrorResponse(
        400,
        "invalid_origin",
        "The request origin is invalid.",
        correlationId,
      );
    try {
      const founder = await dependencies.authorizeFounder();
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
      const result = await (dependencies.read ?? getFacebookWorkspace)(
        dependencies.db,
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
      dependencies.reportUnexpectedError({ correlationId, error });
      return createApiErrorResponse(
        503,
        "unavailable",
        "This action is temporarily unavailable.",
        correlationId,
      );
    }
  };
}
