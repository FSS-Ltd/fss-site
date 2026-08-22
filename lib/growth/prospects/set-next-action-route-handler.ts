import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";
import {
  setNextActionBodySchema,
  SetNextActionError,
  setNextAction as defaultSetNextAction,
  type SetNextActionErrorCode,
  type SetNextActionInput,
  type SetNextActionResult,
} from "./set-next-action";

const ERROR_MAPPING: Record<SetNextActionErrorCode, MessageActionErrorMapping> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The prospect was not found.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "This record changed since you loaded it. Refresh and try again.",
  },
};

export type SetNextActionRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  setNextAction?: (
    db: GrowthDb,
    input: SetNextActionInput,
  ) => Promise<SetNextActionResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createSetNextActionRouteHandler(
  dependencies: SetNextActionRouteDependencies,
): MessageActionRouteHandler {
  const setNextAction = dependencies.setNextAction ?? defaultSetNextAction;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema: setNextActionBodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId: prospectId, founder, correlationId, body }) =>
      setNextAction(dependencies.db, {
        prospectId,
        expectedVersion: body.expectedVersion,
        nextAction: body.nextAction,
        nextActionDueAt: body.nextActionDueAt,
        founder,
        correlationId,
      }),
    mapActionError: (error) =>
      error instanceof SetNextActionError ? ERROR_MAPPING[error.code] : null,
  });
}
