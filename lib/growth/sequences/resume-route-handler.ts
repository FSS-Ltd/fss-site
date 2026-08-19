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
  resumeSequence as defaultResumeSequence,
  SequenceResumeError,
  type ResumedSequence,
  type ResumeSequenceInput,
  type SequenceResumeErrorCode,
} from "./resume";

const bodySchema = z.object({});

const ERROR_MAPPING: Record<SequenceResumeErrorCode, MessageActionErrorMapping> =
  {
    not_found: {
      status: 404,
      code: "not_found",
      message: "The sequence was not found.",
    },
    not_resumable: {
      status: 409,
      code: "not_resumable",
      message: "Only a paused sequence can be resumed.",
    },
  };

export type ResumeRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  resumeSequence?: (
    db: GrowthDb,
    input: ResumeSequenceInput,
  ) => Promise<ResumedSequence>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createResumeRouteHandler(
  dependencies: ResumeRouteDependencies,
): MessageActionRouteHandler {
  const resume = dependencies.resumeSequence ?? defaultResumeSequence;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId: sequenceId, founder, correlationId }) =>
      resume(dependencies.db, {
        sequenceId,
        founder,
        correlationId,
      }),
    mapActionError: (error) =>
      error instanceof SequenceResumeError ? ERROR_MAPPING[error.code] : null,
  });
}
