import { requireFounder, type FounderSession } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
} from "../sequences/message-action-route";
import { facebookCommandSchema } from "./contracts";
import { executeFacebookCommand, FacebookError } from "./service";

type Dependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
  execute?: typeof executeFacebookCommand;
};

export function createFacebookCommandHandler(
  dependencies: Dependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    let duplicateProspectId: string | undefined;
    const handler = createMessageActionHandler({
      ...dependencies,
      authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
      bodySchema: facebookCommandSchema,
      action: ({ body, founder, correlationId }) =>
        (dependencies.execute ?? executeFacebookCommand)(
          dependencies.db,
          body,
          founder,
          correlationId,
        ),
      mapActionError: (error) => {
        if (error instanceof CrmError) {
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
        }
        if (error instanceof FacebookError)
          return {
            status: 409,
            code: error.code,
            message:
              "The action could not be completed. Review the current record and try again.",
          };
        return null;
      },
    });
    const response = await handler(request, {
      params: Promise.resolve({ id: "facebook" }),
    });
    if (duplicateProspectId)
      response.headers.set(
        "location",
        `/growth/prospects/${duplicateProspectId}`,
      );
    return response;
  };
}
