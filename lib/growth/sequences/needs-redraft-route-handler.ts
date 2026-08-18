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
  FirstEmailRedraftError,
  type FirstEmailRedraftErrorCode,
  type FirstEmailRedraftRequest,
  requestFirstEmailRedraft,
  type RequestFirstEmailRedraftInput,
} from "./redraft";

const bodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().min(10).max(1000),
});

const ERROR_MAPPING: Record<
  FirstEmailRedraftErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The first-email draft was not found.",
  },
  not_redraftable: {
    status: 409,
    code: "not_redraftable",
    message: "The first-email draft can no longer be sent back for redraft.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "The first-email draft has changed. Reload and try again.",
  },
  invalid_stored_draft: {
    status: 422,
    code: "invalid_stored_draft",
    message: "The stored draft is invalid.",
  },
};

export type NeedsRedraftRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  requestRedraft?: (
    db: GrowthDb,
    input: RequestFirstEmailRedraftInput,
  ) => Promise<FirstEmailRedraftRequest>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createNeedsRedraftHandler(
  dependencies: NeedsRedraftRouteDependencies,
): MessageActionRouteHandler {
  const requestRedraft =
    dependencies.requestRedraft ?? requestFirstEmailRedraft;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId, founder, correlationId, body }) =>
      requestRedraft(dependencies.db, {
        draftTaskId,
        expectedVersion: body.expectedVersion,
        founder,
        correlationId,
        reason: body.reason,
      }),
    mapActionError: (error) =>
      error instanceof FirstEmailRedraftError
        ? ERROR_MAPPING[error.code]
        : null,
  });
}
