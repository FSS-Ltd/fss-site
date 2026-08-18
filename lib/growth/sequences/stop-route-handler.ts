import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "./message-action-route";
import {
  SequenceStopError,
  stopSequence as defaultStopSequence,
  type SequenceStopErrorCode,
  type StopReason,
  type StoppedSequence,
  type StopSequenceInput,
} from "./stop";

const bodySchema = z.object({});

const ERROR_MAPPING: Record<SequenceStopErrorCode, MessageActionErrorMapping> =
  {
    not_found: {
      status: 404,
      code: "not_found",
      message: "The sequence was not found.",
    },
    already_stopped: {
      status: 409,
      code: "already_stopped",
      message: "This sequence has already been stopped for a different reason.",
    },
  };

export type StopRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  stopSequence?: (
    db: GrowthDb,
    input: StopSequenceInput,
  ) => Promise<StoppedSequence>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createStopRouteHandler(
  reason: StopReason,
  dependencies: StopRouteDependencies,
): MessageActionRouteHandler {
  const stop = dependencies.stopSequence ?? defaultStopSequence;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId: sequenceId, founder, correlationId }) =>
      stop(dependencies.db, {
        sequenceId,
        reason,
        actor: founder,
        correlationId,
      }),
    mapActionError: (error) =>
      error instanceof SequenceStopError ? ERROR_MAPPING[error.code] : null,
  });
}
