import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import type { OperationsFounder } from "../organisations/types";
import {
  RequestConflict,
  RequestValidationError,
  type RequestCommandResult,
} from "../requests/types";
import { privateAuthHeaders } from "../auth/http";
export type FounderRequestDependencies = {
  enabled: boolean;
  origin: string;
  authorizeFounder: () => Promise<OperationsFounder>;
  execute: (
    founder: OperationsFounder,
    organisationId: string,
    command: unknown,
    correlationId: string,
  ) => Promise<RequestCommandResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};
export function createFounderRequestHandler(
  deps: FounderRequestDependencies,
): (
  request: Request,
  organisationId: string,
  requestId: string,
) => Promise<Response> {
  return async (request, organisationId, requestId) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: privateAuthHeaders(correlationId),
      });
    const failure = (error: string, status: number) => reply({ error }, status);
    if (!deps.enabled) return failure("Operations is unavailable.", 404);
    let founder: OperationsFounder;
    try {
      founder = await deps.authorizeFounder();
    } catch {
      return failure("Founder authorization is required.", 403);
    }
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return failure("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return failure("Send a JSON request.", 415);
    try {
      z.uuid().parse(organisationId);
      z.uuid().parse(requestId);
      const command = z
        .record(z.string(), z.unknown())
        .parse(await readJsonRequestBody(request, 64 * 1024));
      if ("requestId" in command)
        return failure("Use the request selected by this page.", 400);
      const result = await deps.execute(
        founder,
        organisationId,
        { ...command, requestId },
        correlationId,
      );
      return reply({ request: result }, 200);
    } catch (error) {
      if (error instanceof RequestConflict)
        return failure(
          "This request changed. Refresh before trying again. Your draft has been kept.",
          409,
        );
      if (error instanceof RequestValidationError)
        return failure(error.message, 400);
      if (error instanceof z.ZodError)
        return reply(
          {
            error: "Check the marked fields.",
            fields: Object.fromEntries(
              error.issues.map((issue) => [
                issue.path.join("."),
                issue.message,
              ]),
            ),
          },
          400,
        );
      if (error instanceof PayloadTooLargeError)
        return failure("The request is too large.", 413);
      if (error instanceof SyntaxError)
        return failure("The request must contain valid JSON.", 400);
      const name = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(name) ? name : "UnknownError",
      });
      return failure(
        "We couldn’t save your changes. Your draft has been kept. Please try again.",
        503,
      );
    }
  };
}
