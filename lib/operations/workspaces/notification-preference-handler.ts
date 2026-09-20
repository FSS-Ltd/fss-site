import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { privateAuthHeaders } from "../auth/http";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { PortalNotificationPreferences } from "./types";

const commandSchema = z.strictObject({
  organisationId: z.uuid(),
  requestEmailEnabled: z.boolean(),
});

export type NotificationPreferenceHandlerDependencies = {
  enabled: boolean;
  origin: string;
  authorize: () => Promise<VerifiedPortalIdentity | null>;
  update: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    correlationId: string,
    command: { requestEmailEnabled: boolean },
  ) => Promise<PortalNotificationPreferences>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};

export function createNotificationPreferenceHandler(
  deps: NotificationPreferenceHandlerDependencies,
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
      if (!identity)
        return respond({ error: "Authorization is required." }, 403);
      const command = commandSchema.parse(
        await readJsonRequestBody(request, 1024),
      );
      const preferences = await deps.update(
        identity,
        command.organisationId,
        correlationId,
        { requestEmailEnabled: command.requestEmailEnabled },
      );
      return respond({ preferences }, 200);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return respond({ error: "Check the notification preference." }, 400);
      if (error instanceof PayloadTooLargeError)
        return respond({ error: "The request is too large." }, 413);
      const name = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(name) ? name : "UnknownError",
      });
      return respond(
        { error: "Preferences could not be saved. Please try again." },
        503,
      );
    }
  };
}
