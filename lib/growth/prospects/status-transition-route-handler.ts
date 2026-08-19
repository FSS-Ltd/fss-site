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
  ProspectStatusTransitionError,
  transitionProspectStatus as defaultTransitionProspectStatus,
  type ProspectStatusTransitionErrorCode,
  type ProspectStatusTransitionReason,
  type ProspectStatusTransitionResult,
  type TransitionProspectStatusInput,
} from "./status-transition";

const bodySchema = z.object({ expectedVersion: z.number().int().min(1) });

const ERROR_MAPPING: Record<
  ProspectStatusTransitionErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The prospect was not found.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "This prospect changed since you loaded it. Refresh and try again.",
  },
  already_terminal: {
    status: 409,
    code: "already_terminal",
    message: "This prospect is already in a final state.",
  },
};

export type ProspectStatusTransitionRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  transitionProspectStatus?: (
    db: GrowthDb,
    input: TransitionProspectStatusInput,
  ) => Promise<ProspectStatusTransitionResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createProspectStatusTransitionRouteHandler(
  reason: ProspectStatusTransitionReason,
  dependencies: ProspectStatusTransitionRouteDependencies,
): MessageActionRouteHandler {
  const transition =
    dependencies.transitionProspectStatus ?? defaultTransitionProspectStatus;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId: prospectId, founder, correlationId, body }) =>
      transition(dependencies.db, {
        prospectId,
        reason,
        expectedVersion: body.expectedVersion,
        founder,
        correlationId,
      }),
    mapActionError: (error) =>
      error instanceof ProspectStatusTransitionError
        ? ERROR_MAPPING[error.code]
        : null,
  });
}
