import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { privateAuthHeaders } from "../auth/http";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";

const commandSchema = z.strictObject({
  ids: z.array(z.uuid()).min(1).max(100),
});

export type NotificationReadHandlerDependencies = {
  authorize: () => Promise<VerifiedPortalIdentity | null>;
  createCorrelationId: () => string;
  enabled: boolean;
  origin: string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
  update: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    correlationId: string,
    ids: readonly string[],
  ) => Promise<void>;
};

export function createNotificationReadHandler(
  deps: NotificationReadHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const respond = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: privateAuthHeaders(correlationId),
      });
    if (!deps.enabled) return respond({ error: "Portal is unavailable." }, 404);
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return respond({ error: "The request origin is not allowed." }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return respond({ error: "Send a JSON request." }, 415);

    try {
      const identity = await deps.authorize();
      if (!identity) return respond({ error: "Sign in to continue." }, 401);
      const organisationId = z
        .uuid()
        .parse(new URL(request.url).searchParams.get("organisationId"));
      const command = commandSchema.parse(
        await readJsonRequestBody(request, 4096),
      );
      await deps.update(identity, organisationId, correlationId, command.ids);
      return respond({ ok: true }, 200);
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return respond(
          { error: "This workspace is not available to your account." },
          404,
        );
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return respond({ error: "Invalid notification list." }, 400);
      if (error instanceof PayloadTooLargeError)
        return respond({ error: "The request is too large." }, 413);
      const name = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(name) ? name : "UnknownError",
      });
      return respond(
        { error: "Notifications could not be updated. Please try again." },
        503,
      );
    }
  };
}
