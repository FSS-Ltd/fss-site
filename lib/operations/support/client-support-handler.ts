import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "../auth/http";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import {
  parsePortalSupportRequest,
  type PortalSupportRequest,
  type PortalSupportRequestReceipt,
} from "./client-support";

const commandSchema = z.strictObject({
  category: z.string(),
  idempotencyKey: z.uuid(),
  message: z.string(),
  organisationId: z.uuid(),
  subject: z.string(),
});

export type PortalSupportRequestHandlerDependencies =
  PortalAuthHandlerDependencies & {
    getIdentity: () => Promise<VerifiedPortalIdentity | null>;
    consumeRateLimit: (
      identity: VerifiedPortalIdentity,
      organisationId: string,
      correlationId: string,
    ) => Promise<boolean>;
    create: (
      identity: VerifiedPortalIdentity,
      organisationId: string,
      correlationId: string,
      command: PortalSupportRequest,
    ) => Promise<PortalSupportRequestReceipt>;
  };

export function createPortalSupportRequestHandler(
  deps: PortalSupportRequestHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const respond = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: privateAuthHeaders(correlationId),
      });
    if (!deps.enabled)
      return respond({ error: "The portal is unavailable." }, 404);
    if (!deps.configured)
      return respond(
        { error: "The portal is temporarily unavailable. Please try again." },
        503,
      );
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return respond({ error: "The request origin is not allowed." }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return respond({ error: "Send a JSON request." }, 415);

    try {
      const identity = await deps.getIdentity();
      if (!identity)
        return respond(
          { error: "Sign in to continue before sending a help request." },
          401,
        );
      const command = commandSchema.parse(
        await readJsonRequestBody(request, 24 * 1024),
      );
      const { organisationId, ...supportInput } = command;
      const supportCommand = parsePortalSupportRequest(supportInput);
      if (
        !(await deps.consumeRateLimit(identity, organisationId, correlationId))
      )
        return respond(
          { error: "Too many requests. Wait a minute and try again." },
          429,
        );
      const supportRequest = await deps.create(
        identity,
        organisationId,
        correlationId,
        supportCommand,
      );
      return respond({ request: supportRequest }, 200);
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return respond(
          { error: "This workspace is not available to your account." },
          404,
        );
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return respond({ error: "Check the help request details." }, 400);
      if (error instanceof PayloadTooLargeError)
        return respond({ error: "The help request is too large." }, 413);
      reportAuthError(deps, correlationId, error);
      return respond(
        { error: "We could not save your help request. Please try again." },
        503,
      );
    }
  };
}
