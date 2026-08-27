import {
  createAgentEmptyPostHandler,
  type AgentEmptyPostHandlerDependencies,
} from "../../integrations/agent-empty-post-handler";
import type { BackfillProspectPreviewsResult } from "../backfill";

type CurrentTenDraftBackfillResponse =
  | ({ status: "backfilled" } & BackfillProspectPreviewsResult)
  | {
      status: "disabled";
      scanned: number;
      created: number;
      skipped: number;
      invalid: number;
    };

export type CurrentTenDraftBackfillRouteDependencies = Omit<
  AgentEmptyPostHandlerDependencies<CurrentTenDraftBackfillResponse>,
  | "maxRequestBytes"
  | "oversizedRequestMessage"
  | "nonEmptyRequestMessage"
  | "readFailureMessage"
  | "operationFailureMessage"
  | "disabledResponse"
  | "run"
> & {
  run: () => Promise<BackfillProspectPreviewsResult>;
};

export function createCurrentTenDraftBackfillPostHandler(
  dependencies: CurrentTenDraftBackfillRouteDependencies,
): (request: Request) => Promise<Response> {
  return createAgentEmptyPostHandler({
    ...dependencies,
    maxRequestBytes: 1,
    oversizedRequestMessage: "Draft backfill request exceeds 1 byte.",
    nonEmptyRequestMessage: "Draft backfill request must be empty.",
    readFailureMessage: "Unable to read the draft backfill request.",
    operationFailureMessage: "Unable to backfill prospect preview drafts.",
    disabledResponse: {
      status: "disabled",
      scanned: 0,
      created: 0,
      skipped: 0,
      invalid: 0,
    },
    run: async () => ({ status: "backfilled", ...(await dependencies.run()) }),
  });
}
