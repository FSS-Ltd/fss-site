import {
  createAgentEmptyPostHandler,
  type AgentEmptyPostHandlerDependencies,
} from "../../integrations/agent-empty-post-handler";
import type { CurrentTenPreviewGenerationInventory } from "../composition-repository";

type CurrentTenPreviewInventoryResponse =
  | ({ status: "inventory" } & CurrentTenPreviewGenerationInventory)
  | ({ status: "disabled" } & CurrentTenPreviewGenerationInventory);

export type CurrentTenPreviewInventoryRouteDependencies = Omit<
  AgentEmptyPostHandlerDependencies<CurrentTenPreviewInventoryResponse>,
  | "maxRequestBytes"
  | "oversizedRequestMessage"
  | "nonEmptyRequestMessage"
  | "readFailureMessage"
  | "operationFailureMessage"
  | "disabledResponse"
  | "run"
> & {
  run: () => Promise<CurrentTenPreviewGenerationInventory>;
};

export function createCurrentTenPreviewInventoryPostHandler(
  dependencies: CurrentTenPreviewInventoryRouteDependencies,
): (request: Request) => Promise<Response> {
  return createAgentEmptyPostHandler({
    ...dependencies,
    maxRequestBytes: 1,
    oversizedRequestMessage: "Preview inventory request exceeds 1 byte.",
    nonEmptyRequestMessage: "Preview inventory request must be empty.",
    readFailureMessage: "Unable to read the preview inventory request.",
    operationFailureMessage: "Unable to inspect current-ten preview generation.",
    disabledResponse: {
      status: "disabled",
      activeDrafts: 0,
      assessedDrafts: 0,
      pendingAssessedDrafts: 0,
      eligibleDrafts: 0,
    },
    run: async () => ({ status: "inventory", ...(await dependencies.run()) }),
  });
}
