import { z } from "zod";
import { randomUUID } from "node:crypto";
import { resolvePortalOrigin } from "../auth/configuration";
import { privateAuthHeaders } from "../auth/http";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { engagementCommandSchema } from "../agreements/engagement-command";
import type { CompletedEngagementCommand } from "../agreements/engagement-service";
import {
  EngagementCommandConflict,
  completeStaffEngagementCommand,
} from "../agreements/engagement-service";
import { getPortalIdentity } from "../auth/server";
import { requireFssAdmin } from "../auth/require-admin";
import type { FssAdminContext } from "../auth/staff-types";
import { fssStudioEnabled } from "../auth/release-flags";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";

export type StaffEngagementRouteDependencies<TActor> = Readonly<{
  authorize: () => Promise<TActor>;
  createCorrelationId: () => string;
  enabled: boolean;
  execute: (
    actor: TActor,
    organisationId: string,
    command: unknown,
    correlationId: string,
  ) => Promise<CompletedEngagementCommand>;
  origin: string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
}>;

export function createStaffEngagementRouteHandler<TActor>(
  dependencies: StaffEngagementRouteDependencies<TActor>,
): (request: Request, organisationId: string) => Promise<Response> {
  return async (request, organisationId) => {
    const correlationId = dependencies.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        headers: privateAuthHeaders(correlationId),
        status,
      });
    const failure = (error: string, status: number) => reply({ error }, status);

    if (!dependencies.enabled)
      return failure("FSS Studio is unavailable.", 404);
    let actor: TActor;
    try {
      actor = await dependencies.authorize();
    } catch {
      return failure("FSS Studio authorization is required.", 403);
    }
    if (!requestHasRegisteredOrigin(request, dependencies.origin))
      return failure("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return failure("Send a JSON request.", 415);

    try {
      const organisation = z.uuid().parse(organisationId);
      const command = engagementCommandSchema.parse(
        await readJsonRequestBody(request, 64 * 1024),
      );
      return reply(
        await dependencies.execute(actor, organisation, command, correlationId),
        200,
      );
    } catch (error) {
      if (error instanceof EngagementCommandConflict)
        return failure(error.message, 409);
      if (error instanceof z.ZodError)
        return failure("Check the engagement details and try again.", 400);
      if (error instanceof PayloadTooLargeError)
        return failure("The engagement details are too large.", 413);
      if (error instanceof SyntaxError)
        return failure("The request must contain valid JSON.", 400);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      dependencies.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(errorName)
          ? errorName
          : "UnknownError",
      });
      return failure(
        "We could not save this engagement. Your details are still here. Please try again.",
        503,
      );
    }
  };
}

export function staffEngagementRoute(): (
  request: Request,
  organisationId: string,
) => Promise<Response> {
  return createStaffEngagementRouteHandler<FssAdminContext>({
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && fssStudioEnabled(),
    execute: (admin, organisationId, command, correlationId) =>
      completeStaffEngagementCommand(
        getOperationsDb(),
        admin,
        organisationId,
        command,
        correlationId,
      ),
    origin: resolvePortalOrigin(),
    reportUnexpectedError: (report) =>
      console.error("Staff engagement command failed.", report),
  });
}
