import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { privateAuthHeaders } from "../auth/http";
import { resolvePortalOrigin } from "../auth/configuration";
import { fssStudioEnabled } from "../auth/release-flags";
import { requireFssAdmin } from "../auth/require-admin";
import { getPortalIdentity } from "../auth/server";
import type { FssAdminContext } from "../auth/staff-types";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import {
  executeStaffWelcomePackCommand,
  WelcomePackConflict,
} from "../onboarding/welcome-packs";

export function staffWelcomePackRoute(deps?: {
  authorize: () => Promise<FssAdminContext | null>;
  enabled: boolean;
  origin: string;
  execute: (
    admin: FssAdminContext,
    input: unknown,
    correlationId: string,
  ) => Promise<unknown>;
  createCorrelationId: () => string;
}) {
  const runtime = deps ?? {
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) return null;
      try {
        return await requireFssAdmin(getPortalDb(), identity, randomUUID());
      } catch {
        return null;
      }
    },
    enabled: operationsEnabled() && fssStudioEnabled(),
    origin: resolvePortalOrigin(),
    execute: (admin: FssAdminContext, input: unknown) =>
      executeStaffWelcomePackCommand(getOperationsDb(), admin, input),
    createCorrelationId: randomUUID,
  };

  return async (request: Request): Promise<Response> => {
    const correlationId = runtime.createCorrelationId();
    const headers = privateAuthHeaders(correlationId);
    const reply = (body: unknown, status = 200) =>
      Response.json(body, { status, headers });
    if (!runtime.enabled)
      return reply({ error: "FSS Studio is unavailable." }, 404);
    if (!requestHasRegisteredOrigin(request, runtime.origin))
      return reply({ error: "The request origin is not allowed." }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply({ error: "Send a JSON request." }, 415);
    try {
      const admin = await runtime.authorize();
      if (!admin)
        return reply({ error: "FSS Studio authorization is required." }, 403);
      const input = await readJsonRequestBody(request, 512 * 1024);
      return reply(await runtime.execute(admin, input, correlationId));
    } catch (error) {
      if (error instanceof WelcomePackConflict)
        return reply({ error: error.message }, 409);
      if (error instanceof z.ZodError)
        return reply({ error: "Check the welcome pack fields." }, 400);
      if (error instanceof PayloadTooLargeError)
        return reply({ error: "The welcome pack is too large." }, 413);
      if (error instanceof SyntaxError)
        return reply({ error: "The request must contain valid JSON." }, 400);
      return reply({ error: "We could not save the welcome pack." }, 503);
    }
  };
}
