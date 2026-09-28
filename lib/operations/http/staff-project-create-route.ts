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
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { executeStaffProjectCreateCommand } from "../projects/staff-service";
import { ProjectConflict } from "../projects/types";

export type StaffProjectCreateRouteDependencies<TActor> = Readonly<{
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

export function createStaffProjectCreateRouteHandler<TActor>(
  deps: StaffProjectCreateRouteDependencies<TActor>,
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
    )
      return failure("Send a JSON request.", 415);

    try {
      const clientId = z.uuid().parse(organisationId);
      const project = await deps.execute(
        actor,
        clientId,
        await readJsonRequestBody(request, 64 * 1024),
        correlationId,
      );
      return reply(project, 201);
    } catch (error) {
      if (error instanceof ProjectConflict) return failure(error.message, 409);
      if (error instanceof z.ZodError)
        return failure("Check the marked fields.", 400);
      if (error instanceof PayloadTooLargeError)
        return failure("The project details are too large.", 413);
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
        "We could not create this project. Please try again.",
        503,
      );
    }
  };
}

export function staffProjectCreateRoute() {
  return createStaffProjectCreateRouteHandler<FssAdminContext>({
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && fssStudioEnabled(),
    execute: (admin, organisationId, input, correlationId) =>
      executeStaffProjectCreateCommand(
        getOperationsDb(),
        admin,
        organisationId,
        input,
        correlationId,
      ),
    origin: new URL(resolveSiteUrl()).origin,
    reportUnexpectedError: (report) =>
      console.error("Staff project creation failed.", report),
  });
}
