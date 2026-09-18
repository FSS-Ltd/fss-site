import { randomUUID } from "node:crypto";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getPortalIdentity } from "../auth/server";
import { requireFssAdmin } from "../auth/require-admin";
import type { FssAdminContext } from "../auth/staff-types";
import { operationsEnabled, getOperationsDb } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { executeStaffRequestCommand } from "../requests/staff-service";
import { createRequestCommandHandler } from "./request-command-handler";

export function staffRequestRoute(): (
  request: Request,
  context: { params: Promise<{ organisationId: string; requestId: string }> },
) => Promise<Response> {
  const commandHandler = createRequestCommandHandler<FssAdminContext>({
    enabled: operationsEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      // The staff grant recheck runs through the verified portal identity;
      // the mutation itself runs under the restricted founder role below.
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    execute: (admin, organisationId, command, correlationId) =>
      executeStaffRequestCommand(
        getOperationsDb(),
        admin,
        organisationId,
        command,
        correlationId,
      ),
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report) =>
      console.error("Staff request action failed.", report),
  });
  return async (request, context) => {
    const { organisationId, requestId } = await context.params;
    return commandHandler(request, organisationId, requestId);
  };
}
