import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { privateAuthHeaders } from "../auth/http";
import { fssStudioEnabled } from "../auth/release-flags";
import { requireFssAdmin } from "../auth/require-admin";
import { getPortalIdentity } from "../auth/server";
import type { FssAdminContext } from "../auth/staff-types";
import { PortalAccessDenied } from "../auth/types";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { RequestValidationError } from "../requests/types";
import { createStaffRequest } from "../requests/staff-service";

export type StaffRequestCreateRouteDependencies<TActor> = Readonly<{
  authorize: () => Promise<TActor>;
  createCorrelationId: () => string;
  enabled: boolean;
  execute: (
    actor: TActor,
    organisationId: string,
    input: unknown,
    correlationId: string,
  ) => Promise<{ id: string; version: number }>;
  origin: string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
}>;

export function createStaffRequestCreateRouteHandler<TActor>(
  deps: StaffRequestCreateRouteDependencies<TActor>,
): (request: Request, organisationId: string) => Promise<Response> {
  return async (request, organisationId) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: privateAuthHeaders(correlationId),
      });
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
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    ) {
      return failure("Send a JSON request.", 415);
    }
    try {
      const result = await deps.execute(
        actor,
        z.uuid().parse(organisationId),
        await readJsonRequestBody(request, 64 * 1024),
        correlationId,
      );
      return reply({ request: result }, 200);
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return failure("FSS Studio authorization is required.", 403);
      if (error instanceof RequestValidationError)
        return failure(error.message, 400);
      if (error instanceof z.ZodError)
        return failure("Check the marked fields.", 400);
      if (error instanceof PayloadTooLargeError)
        return failure("The request details are too large.", 413);
      if (error instanceof SyntaxError)
        return failure("The request must contain valid JSON.", 400);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(errorName)
          ? errorName
          : "UnknownError",
      });
      return failure(
        "We could not create this request. Your draft is still here. Please try again.",
        503,
      );
    }
  };
}

export function staffRequestCreateRoute(): (
  request: Request,
  organisationId: string,
) => Promise<Response> {
  return createStaffRequestCreateRouteHandler<FssAdminContext>({
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && fssStudioEnabled(),
    execute: (admin, organisationId, input, correlationId) =>
      createStaffRequest(
        getOperationsDb(),
        admin,
        organisationId,
        input,
        correlationId,
      ),
    origin: new URL(resolveSiteUrl()).origin,
    reportUnexpectedError: (report) =>
      console.error("Staff request creation failed.", report),
  });
}
