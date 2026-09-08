import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { privateAuthHeaders, reportAuthError } from "../auth/http";
import { JourneyConflict, type JourneyCommandResult } from "./command-types";
export function createJourneyCommandHandler<Identity>(deps: {
  enabled: boolean;
  origin: string;
  authorize: () => Promise<Identity | null>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
  execute: (
    identity: Identity,
    organisationId: string,
    command: unknown,
  ) => Promise<JourneyCommandResult>;
}) {
  return async (
    request: Request,
    organisationId: string,
  ): Promise<Response> => {
    const correlationId = deps.createCorrelationId();
    const headers = privateAuthHeaders(correlationId);
    const reply = (message: string, status: number, code?: string) =>
      Response.json({ message, code }, { status, headers });
    if (!deps.enabled) return reply("Journeys are unavailable.", 404);
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return reply("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply("Send a JSON request.", 415);
    try {
      const identity = await deps.authorize();
      if (!identity) return reply("Sign in to continue.", 401);
      z.uuid().parse(organisationId);
      const raw = await readJsonRequestBody(request, 4_100_000);
      return Response.json(await deps.execute(identity, organisationId, raw), {
        headers,
      });
    } catch (error) {
      if (error instanceof JourneyConflict)
        return reply(error.message, 409, error.code);
      if (error instanceof z.ZodError)
        return reply(
          "Check the journey details and required confirmations.",
          422,
        );
      if (error instanceof PayloadTooLargeError)
        return reply("The request is too large.", 413);
      if (error instanceof SyntaxError) return reply("Send valid JSON.", 400);
      reportAuthError(deps, correlationId, error);
      return reply(
        "We could not confirm the result. Refresh the journey before trying again.",
        503,
      );
    }
  };
}
