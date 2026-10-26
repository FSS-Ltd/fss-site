import { z } from "zod";
import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import { createApiErrorResponse, createJsonResponse } from "../http/api-error";
import type { MessageActionRouteHandler } from "../sequences/message-action-route";
import type { MessageReviewResult } from "./message-review";

export function createMessageReviewHandler(dependencies: {
  authorizeFounder: () => Promise<FounderSession>;
  loadReview: (draftTaskId: string) => Promise<MessageReviewResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
}): MessageActionRouteHandler {
  return async (_request, context) => {
    const correlationId = dependencies.createCorrelationId();
    try {
      await dependencies.authorizeFounder();
      const { id } = await context.params;
      if (!z.uuid().safeParse(id).success) {
        return createApiErrorResponse(
          422,
          "invalid_id",
          "The draft ID is invalid.",
          correlationId,
        );
      }
      return createJsonResponse(await dependencies.loadReview(id), 200);
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        return createApiErrorResponse(
          401,
          "unauthorized",
          "Founder authorization is required.",
          correlationId,
        );
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return createApiErrorResponse(
        500,
        "review_unavailable",
        "The email draft could not load.",
        correlationId,
      );
    }
  };
}
