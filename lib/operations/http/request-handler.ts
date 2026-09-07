import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "../auth/http";
import {
  RequestConflict,
  RequestValidationError,
  type ClientRequest,
  type RequestCommandResult,
} from "../requests/types";

export type PortalRequestDependencies = PortalAuthHandlerDependencies & {
  getIdentity: () => Promise<VerifiedPortalIdentity | null>;
  consumeRateLimit: (
    request: Request,
    identity: VerifiedPortalIdentity,
    organisationId: string,
    correlationId: string,
  ) => Promise<boolean>;
  execute: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    command: unknown,
    correlationId: string,
  ) => Promise<ClientRequest | RequestCommandResult>;
};
const envelope = z.strictObject({
  organisationId: z.uuid(),
  command: z.record(z.string(), z.unknown()),
});

export function createPortalRequestHandler(
  deps: PortalRequestDependencies,
): (request: Request, requestId?: string) => Promise<Response> {
  return async (request, requestId) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: privateAuthHeaders(correlationId),
      });
    const failure = (error: string, status: number) => reply({ error }, status);
    if (!deps.enabled) return failure("The portal is unavailable.", 404);
    if (!deps.configured)
      return failure(
        "The portal is temporarily unavailable. Please try again.",
        503,
      );
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return failure("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return failure("Send a JSON request.", 415);
    try {
      const identity = await deps.getIdentity();
      if (!identity)
        return failure("Sign in to continue. Your draft has been kept.", 401);
      const input = envelope.parse(
        await readJsonRequestBody(request, 64 * 1024),
      );
      if (
        !(await deps.consumeRateLimit(
          request,
          identity,
          input.organisationId,
          correlationId,
        ))
      )
        return failure("Too many requests. Wait a minute and try again.", 429);
      if (requestId !== undefined) {
        z.uuid().parse(requestId);
        if ("requestId" in input.command)
          return failure("Use the request selected by this page.", 400);
      }
      const command =
        requestId === undefined
          ? input.command
          : { ...input.command, requestId };
      const result = await deps.execute(
        identity,
        input.organisationId,
        command,
        correlationId,
      );
      return reply({ request: result }, 200);
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return failure("This request is not available to your account.", 404);
      if (error instanceof RequestConflict)
        return failure(
          "This request changed. Refresh it before trying again. Your draft has been kept.",
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
      reportAuthError(deps, correlationId, error);
      return failure(
        "We couldn’t save your changes. Your draft has been kept. Please try again.",
        503,
      );
    }
  };
}
