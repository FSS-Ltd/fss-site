import type { z } from "zod";

import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import { createApiErrorResponse, createJsonResponse } from "../http/api-error";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../http/founder-request";
import type {
  MessageActionErrorMapping,
  MessageActionRouteConfig,
} from "../sequences/message-action-route";

const MAX_ACTION_BODY_BYTES = 64 * 1024;

export type FounderActionInput<TBody> = {
  founder: FounderSession;
  correlationId: string;
  body: TBody;
};

export type FounderActionRouteDependencies<TBody, TResult> = {
  config: MessageActionRouteConfig;
  authorizeFounder: () => Promise<FounderSession>;
  bodySchema: z.ZodType<TBody>;
  action: (input: FounderActionInput<TBody>) => Promise<TResult>;
  mapActionError: (error: unknown) => MessageActionErrorMapping | null;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

/** Same origin/auth/body/error contract as message-action-route.ts's
 * createMessageActionHandler, for founder-only actions that are not scoped
 * to a single `[id]` route param. */
export function createFounderActionHandler<TBody, TResult extends object>(
  dependencies: FounderActionRouteDependencies<TBody, TResult>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    const fail = (status: number, code: string, message: string) =>
      createApiErrorResponse(status, code, message, correlationId);

    if (!requestHasRegisteredOrigin(request, dependencies.config.origin)) {
      return fail(400, "invalid_origin", "The request origin is invalid.");
    }

    let founder: FounderSession;
    try {
      founder = await dependencies.authorizeFounder();
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        return fail(401, "unauthorized", "Founder authorization is required.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to authorize the request.");
    }

    let rawBody: unknown;
    try {
      rawBody = await readJsonRequestBody(request, MAX_ACTION_BODY_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return fail(413, "payload_too_large", "The request body is too large.");
      }
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }

    const parsedBody = dependencies.bodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return fail(422, "invalid_body", "The request body failed validation.");
    }

    try {
      const result = await dependencies.action({
        founder,
        correlationId,
        body: parsedBody.data,
      });
      return createJsonResponse({ ok: true, correlationId, ...result }, 200);
    } catch (error) {
      const mapped = dependencies.mapActionError(error);
      if (mapped) {
        return fail(mapped.status, mapped.code, mapped.message);
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(
        500,
        "internal_error",
        "Unable to complete the requested action.",
      );
    }
  };
}
