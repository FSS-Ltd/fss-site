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

const MAX_MESSAGE_ACTION_BODY_BYTES = 64 * 1024;

export type MessageActionRouteConfig = { origin: string };

export type MessageActionErrorMapping = {
  status: number;
  code: string;
  message: string;
};

export type MessageActionInput<TBody> = {
  draftTaskId: string;
  founder: FounderSession;
  correlationId: string;
  body: TBody;
};

export type MessageActionRouteDependencies<TBody, TResult> = {
  config: MessageActionRouteConfig;
  authorizeFounder: () => Promise<FounderSession>;
  bodySchema: z.ZodType<TBody>;
  action: (input: MessageActionInput<TBody>) => Promise<TResult>;
  mapActionError: (error: unknown) => MessageActionErrorMapping | null;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export type MessageActionRouteHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

export function createMessageActionHandler<TBody, TResult extends object>(
  dependencies: MessageActionRouteDependencies<TBody, TResult>,
): MessageActionRouteHandler {
  return async (request, context) => {
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

    const { id: draftTaskId } = await context.params;

    let rawBody: unknown;
    try {
      rawBody = await readJsonRequestBody(
        request,
        MAX_MESSAGE_ACTION_BODY_BYTES,
      );
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
        draftTaskId,
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
