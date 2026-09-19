import { randomUUID } from "node:crypto";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getPortalIdentity } from "../auth/server";
import { requireFssAdmin } from "../auth/require-admin";
import type { FssAdminContext } from "../auth/staff-types";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { createAgreementRouteHandler } from "../agreements/route-handler";
import { executeStaffAgreementCommand } from "../agreements/staff-service";

export function staffAgreementRoute(): (
  request: Request,
  organisationId: string,
) => Promise<Response> {
  return createAgreementRouteHandler<FssAdminContext>({
    enabled: operationsEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    execute: (admin, organisationId, input, correlationId) =>
      executeStaffAgreementCommand(
        getOperationsDb(),
        admin,
        organisationId,
        input,
        correlationId,
      ),
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report) =>
      console.error("Staff agreement action failed.", report),
    unauthorizedMessage: "FSS Studio authorization is required.",
  });
}
