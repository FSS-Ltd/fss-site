import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { PortalAccessConflict } from "../auth/operator";
import { privateAuthHeaders } from "../auth/http";
import { fssStudioEnabled } from "../auth/release-flags";
import { requireFssAdmin } from "../auth/require-admin";
import { getPortalIdentity } from "../auth/server";
import type { FssAdminContext } from "../auth/staff-types";
import { resolvePortalOrigin } from "../auth/configuration";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import {
  applyStaffPortalAccessOperation,
  type StaffPortalAccessOutcome,
} from "../studio/portal-access";

export type StaffPortalAccessRouteDependencies<TActor> = Readonly<{
  authorize: () => Promise<TActor>;
  createCorrelationId: () => string;
  enabled: boolean;
  execute: (
    actor: TActor,
    input: unknown,
    correlationId: string,
  ) => Promise<StaffPortalAccessOutcome>;
  origin: string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
}>;

export function createStaffPortalAccessRouteHandler<TActor>(
  deps: StaffPortalAccessRouteDependencies<TActor>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, { headers: privateAuthHeaders(correlationId), status });
    const failure = (error: string, status: number) => reply({ error }, status);
    if (!deps.enabled) return failure("FSS Studio is unavailable.", 404);
    let actor: TActor;
    try {
      actor = await deps.authorize();
    } catch {
      return failure("FSS Studio authorization is required.", 403);
    }
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return failure("The request origin is not allowed.", 403);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      return failure("Send a JSON request.", 415);
    try {
      return reply(
        await deps.execute(
          actor,
          await readJsonRequestBody(request, 16 * 1024),
          correlationId,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof PortalAccessConflict)
        return failure(error.message, 409);
      if (error instanceof z.ZodError)
        return failure("Check the access details and try again.", 400);
      if (error instanceof PayloadTooLargeError)
        return failure("The access details are too large.", 413);
      if (error instanceof SyntaxError)
        return failure("The request must contain valid JSON.", 400);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(errorName) ? errorName : "UnknownError",
      });
      return failure(
        "The invitation outcome could not be confirmed. Refresh the access register before trying again.",
        503,
      );
    }
  };
}

export function staffPortalAccessRoute(): (request: Request) => Promise<Response> {
  return createStaffPortalAccessRouteHandler<FssAdminContext>({
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && fssStudioEnabled(),
    execute: (admin, input) =>
      applyStaffPortalAccessOperation(
        getOperationsDb(),
        admin,
        input,
        resolvePortalOrigin(),
      ),
    origin: new URL(resolveSiteUrl()).origin,
    reportUnexpectedError: (report) =>
      console.error("Staff portal access update failed.", report),
  });
}
