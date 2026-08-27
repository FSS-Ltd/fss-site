import {
  createAgentEmptyPostHandler,
  type AgentEmptyPostHandlerDependencies,
} from "../../integrations/agent-empty-post-handler";
import type { RequeueCurrentTenUnavailablePreviewCompositionsResult } from "../composition-repository";

type CurrentTenPreviewRetryResponse =
  | ({
      status: "requeued";
    } & RequeueCurrentTenUnavailablePreviewCompositionsResult)
  | { status: "disabled"; requeued: number };

export type CurrentTenPreviewRetryRouteDependencies = Omit<
  AgentEmptyPostHandlerDependencies<CurrentTenPreviewRetryResponse>,
  | "maxRequestBytes"
  | "oversizedRequestMessage"
  | "nonEmptyRequestMessage"
  | "readFailureMessage"
  | "operationFailureMessage"
  | "disabledResponse"
  | "run"
> & {
  run: () => Promise<RequeueCurrentTenUnavailablePreviewCompositionsResult>;
};

export function createCurrentTenPreviewRetryPostHandler(
  dependencies: CurrentTenPreviewRetryRouteDependencies,
): (request: Request) => Promise<Response> {
  return createAgentEmptyPostHandler({
    ...dependencies,
    maxRequestBytes: 1,
    oversizedRequestMessage: "Current-ten retry request exceeds 1 byte.",
    nonEmptyRequestMessage: "Current-ten retry request must be empty.",
    readFailureMessage: "Unable to read the current-ten retry request.",
    operationFailureMessage: "Unable to retry current-ten preview generation.",
    disabledResponse: { status: "disabled", requeued: 0 },
    run: async () => ({ status: "requeued", ...(await dependencies.run()) }),
  });
}
