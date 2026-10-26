import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";
import { executeCrmCommand } from "./commands";
import { CrmError } from "./errors";
import {
  crmCommandSchema,
  type CrmCommand,
  type CrmCommandResult,
} from "./schemas";

type Dependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
  execute?: typeof executeCrmCommand;
};
function targetId(command: CrmCommand): string {
  if ("prospectId" in command) return command.prospectId;
  if ("viewId" in command) return command.viewId;
  return command.requestId;
}
export function createCrmCommandHandler(
  dependencies: Dependencies,
): MessageActionRouteHandler {
  return async (request, context) => {
    let duplicateProspectId: string | undefined;
    const handler = createMessageActionHandler<CrmCommand, CrmCommandResult>({
      ...dependencies,
      authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
      bodySchema: crmCommandSchema,
      action: ({ draftTaskId, body, founder, correlationId }) => {
        if (targetId(body) !== draftTaskId) throw new CrmError("invalid");
        return (dependencies.execute ?? executeCrmCommand)(
          dependencies.db,
          body,
          founder,
          correlationId,
        );
      },
      mapActionError: (error) => {
        if (!(error instanceof CrmError)) return null;
        duplicateProspectId = error.prospectId;
        return {
          status:
            error.code === "not_found"
              ? 404
              : error.code === "invalid"
                ? 422
                : 409,
          code: error.code,
          message: error.message,
        };
      },
    });
    const response = await handler(request, context);
    if (duplicateProspectId)
      response.headers.set(
        "location",
        `/growth/prospects/${duplicateProspectId}`,
      );
    return response;
  };
}
