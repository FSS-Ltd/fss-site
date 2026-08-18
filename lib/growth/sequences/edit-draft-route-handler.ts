import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  FirstEmailRevisionError,
  type FirstEmailRevisionErrorCode,
  type FounderFirstEmailRevision,
  reviseFirstEmailDraft,
  type ReviseFirstEmailDraftInput,
} from "./first-email-revisions";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "./message-action-route";

const bodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  subject: z.string().min(1).max(200),
  paragraphs: z.array(z.string().min(1)).min(1).max(20),
});

const ERROR_MAPPING: Record<
  FirstEmailRevisionErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The first-email draft was not found.",
  },
  not_editable: {
    status: 409,
    code: "not_editable",
    message: "The first-email draft can no longer be edited.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "The first-email draft has changed. Reload and try again.",
  },
  revision_limit_reached: {
    status: 422,
    code: "revision_limit_reached",
    message: "This draft has reached its revision limit.",
  },
  invalid_stored_draft: {
    status: 422,
    code: "invalid_stored_draft",
    message: "The stored draft is invalid.",
  },
};

export type EditDraftRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  reviseDraft?: (
    db: GrowthDb,
    input: ReviseFirstEmailDraftInput,
  ) => Promise<FounderFirstEmailRevision>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createEditDraftHandler(
  dependencies: EditDraftRouteDependencies,
): MessageActionRouteHandler {
  const reviseDraft = dependencies.reviseDraft ?? reviseFirstEmailDraft;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId, founder, correlationId, body }) =>
      reviseDraft(dependencies.db, {
        draftTaskId,
        expectedVersion: body.expectedVersion,
        founder,
        correlationId,
        subject: body.subject,
        paragraphs: body.paragraphs,
      }),
    mapActionError: (error) =>
      error instanceof FirstEmailRevisionError
        ? ERROR_MAPPING[error.code]
        : null,
  });
}
