import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";
import {
  transitionEngagement as defaultTransitionEngagement,
  TransitionEngagementError,
  type TransitionEngagementContext,
  type TransitionEngagementErrorCode,
  type TransitionEngagementResult,
} from "./transition-engagement";

// The real validation of dimension/toStage/toStatus/reasonCode/values lives
// in transitionEngagement's own Zod schema (it needs to see the whole
// command, including engagementId, to apply its stage-specific
// refinements). This route only needs the body to be a JSON object so
// engagementId can be merged in from the URL.
const bodySchema = z.record(z.string(), z.unknown());

const ERROR_MAPPING: Record<
  TransitionEngagementErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The engagement was not found.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "This engagement changed since you loaded it. Refresh and try again.",
  },
  invalid_transition: {
    status: 409,
    code: "invalid_transition",
    message: "That move is not permitted from the current stage.",
  },
  delivery_requires_won: {
    status: 409,
    code: "delivery_requires_won",
    message: "Delivery cannot start until the commercial stage is won.",
  },
};

export type EngagementTransitionRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  transitionEngagement?: (
    db: GrowthDb,
    rawInput: unknown,
    context: TransitionEngagementContext,
  ) => Promise<TransitionEngagementResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createEngagementTransitionRouteHandler(
  dependencies: EngagementTransitionRouteDependencies,
): MessageActionRouteHandler {
  const transition =
    dependencies.transitionEngagement ?? defaultTransitionEngagement;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId: engagementId, founder, correlationId, body }) =>
      transition(
        dependencies.db,
        { ...body, engagementId },
        { founder, correlationId },
      ),
    mapActionError: (error) => {
      if (error instanceof TransitionEngagementError) {
        return ERROR_MAPPING[error.code];
      }
      if (error instanceof z.ZodError) {
        return {
          status: 422,
          code: "invalid_body",
          message: "The request body failed validation.",
        };
      }
      return null;
    },
  });
}
