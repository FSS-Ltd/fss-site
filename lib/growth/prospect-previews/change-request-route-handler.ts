import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";
import {
  createPreviewChangeRequest as defaultCreatePreviewChangeRequest,
  type CreatePreviewChangeRequestInput,
  type PreviewChangeRequest,
} from "./change-requests";

const bodySchema = z
  .object({
    compositionDigest: z.string().regex(/^[a-f0-9]{64}$/),
    notes: z.string().trim().min(1).max(2_000),
  })
  .strict();

class PreviewChangeRequestError extends Error {
  constructor(readonly code: "not_found") {
    super(code);
    this.name = "PreviewChangeRequestError";
  }
}

export type PreviewChangeRequestRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  createPreviewChangeRequest?: (
    input: CreatePreviewChangeRequestInput,
    db: GrowthDb,
  ) => Promise<PreviewChangeRequest | null>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createPreviewChangeRequestRouteHandler(
  dependencies: PreviewChangeRequestRouteDependencies,
): MessageActionRouteHandler {
  const createChangeRequest =
    dependencies.createPreviewChangeRequest ?? defaultCreatePreviewChangeRequest;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: async ({ draftTaskId: prospectId, founder, body }) => {
      const changeRequest = await createChangeRequest(
        {
          prospectId,
          compositionDigest: body.compositionDigest,
          notes: body.notes,
          createdBy: founder.actorId,
        },
        dependencies.db,
      );
      if (changeRequest === null) {
        throw new PreviewChangeRequestError("not_found");
      }
      return changeRequest;
    },
    mapActionError: (error) =>
      error instanceof PreviewChangeRequestError
        ? {
            status: 404,
            code: "not_found",
            message: "The source package is no longer available for review.",
          }
        : null,
  });
}
