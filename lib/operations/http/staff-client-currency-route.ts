import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { getPortalIdentity } from "../auth/server";
import { requireFssAdmin } from "../auth/require-admin";
import type { FssAdminContext } from "../auth/staff-types";
import { privateAuthHeaders } from "../auth/http";
import { fssStudioEnabled } from "../auth/release-flags";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import {
  updateStaffClientCurrency,
  StudioClientCurrencyConflict,
  type StaffClientCurrencyResult,
} from "../organisations/staff-service";

export type StaffClientCurrencyRouteDependencies<TActor> = Readonly<{
  authorize: () => Promise<TActor>;
  createCorrelationId: () => string;
  enabled: boolean;
  execute: (
    actor: TActor,
    organisationId: string,
    input: unknown,
    correlationId: string,
  ) => Promise<StaffClientCurrencyResult>;
  origin: string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
}>;

export function createStaffClientCurrencyRouteHandler<TActor>(
  deps: StaffClientCurrencyRouteDependencies<TActor>,
  organisationId: string,
): (request: Request) => Promise<Response> {
  return async (request) => {
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
      const client = await deps.execute(
        actor,
        z.uuid().parse(organisationId),
        await readJsonRequestBody(request, 64 * 1024),
        correlationId,
      );
      return reply(client, 200);
    } catch (error) {
      if (error instanceof StudioClientCurrencyConflict)
        return failure(error.message, 409);
      if (error instanceof z.ZodError) {
        return reply(
          {
            error: "Check the marked fields.",
            fields: Object.fromEntries(
              error.issues.map((issue) => [
                issue.path.join("."),
                issue.message,
              ]),
            ),
          },
          400,
        );
      }
      if (error instanceof PayloadTooLargeError)
        return failure("The currency change is too large.", 413);
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
        "We could not save the currency. Your details are still here. Please try again.",
        503,
      );
    }
  };
}

export function staffClientCurrencyRoute(
  organisationId: string,
): (request: Request) => Promise<Response> {
  return createStaffClientCurrencyRouteHandler<FssAdminContext>(
    {
      authorize: async () => {
        const identity = await getPortalIdentity();
        if (!identity) throw new Error("unauthorized");
        return requireFssAdmin(getPortalDb(), identity, randomUUID());
      },
      createCorrelationId: randomUUID,
      enabled: operationsEnabled() && fssStudioEnabled(),
      execute: (admin, id, input, correlationId) =>
        updateStaffClientCurrency(
          getOperationsDb(),
          admin,
          id,
          input,
          correlationId,
        ),
      origin: new URL(resolveSiteUrl()).origin,
      reportUnexpectedError: (report) =>
        console.error("Staff client currency update failed.", report),
    },
    organisationId,
  );
}
