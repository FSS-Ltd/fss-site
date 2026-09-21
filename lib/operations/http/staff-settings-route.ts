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
import { saveStudioSettingsDraft, StudioSettingsConflict } from "../studio/settings";
import { getPortalDb } from "../db/portal-client";

type SavedDraft = Readonly<{ revision: number; createdAt: string }>;

export type StaffSettingsRouteDependencies<TActor> = Readonly<{
  authorize: () => Promise<TActor>;
  createCorrelationId: () => string;
  enabled: boolean;
  execute: (actor: TActor, input: unknown, correlationId: string) => Promise<SavedDraft>;
  origin: string;
  reportUnexpectedError: (report: { correlationId: string; errorName: string }) => void;
}>;

export function createStaffSettingsRouteHandler<TActor>(
  deps: StaffSettingsRouteDependencies<TActor>,
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
      if (error instanceof StudioSettingsConflict)
        return failure(error.message, 409);
      if (error instanceof z.ZodError)
        return failure("Check the settings draft and try again.", 400);
      if (error instanceof PayloadTooLargeError)
        return failure("The settings draft is too large.", 413);
      if (error instanceof SyntaxError)
        return failure("The request must contain valid JSON.", 400);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(errorName) ? errorName : "UnknownError",
      });
      return failure("We could not save this settings draft. Your edits are still here.", 503);
    }
  };
}

export function staffSettingsRoute(): (request: Request) => Promise<Response> {
  return createStaffSettingsRouteHandler<FssAdminContext>({
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && fssStudioEnabled(),
    execute: (admin, input, correlationId) =>
      saveStudioSettingsDraft(getOperationsDb(), admin, input, correlationId),
    origin: new URL(resolveSiteUrl()).origin,
    reportUnexpectedError: (report) =>
      console.error("Studio settings draft failed.", report),
  });
}
