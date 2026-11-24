import { z } from "zod";
import { requireFounder, type FounderSession } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";
import {
  founderVerificationInputSchema,
  verifyFounderEvidence,
} from "./founder-verification";

const bodySchema = founderVerificationInputSchema
  .omit({ prospectId: true })
  .extend({
    contactObservedAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
    observedAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
  });
export function createFounderVerificationHandler(deps: {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  verify?: typeof verifyFounderEvidence;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
}): MessageActionRouteHandler {
  return createMessageActionHandler({
    config: deps.config,
    authorizeFounder: deps.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: deps.createCorrelationId,
    reportUnexpectedError: deps.reportUnexpectedError,
    action: async ({ draftTaskId, body, founder, correlationId }) => {
      const prospectId = z.uuid().safeParse(draftTaskId);
      if (!prospectId.success) throw new CrmError("invalid");
      const result = await (deps.verify ?? verifyFounderEvidence)(
        deps.db,
        { ...body, prospectId: prospectId.data },
        founder,
        correlationId,
      );
      return {
        prospectVersion: result.prospectVersion,
        alreadyExisted: result.alreadyExisted,
      };
    },
    mapActionError: (error) =>
      error instanceof CrmError
        ? {
            status:
              error.code === "not_found"
                ? 404
                : error.code === "invalid"
                  ? 422
                  : 409,
            code: error.code,
            message: error.message,
          }
        : null,
  });
}
