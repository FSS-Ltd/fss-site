import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolvePortalOrigin } from "../auth/configuration";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { privateAuthHeaders, reportAuthError } from "../auth/http";
import { fssStudioEnabled } from "../auth/release-flags";
import { getPortalIdentity } from "../auth/server";
import { requireFssAdmin } from "../auth/require-admin";
import { PortalAccessDenied } from "../auth/types";
import { getOperationsDb } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { signingEnabled } from "../agreements/signing-worker";
import { AgreementConflict } from "../agreements/types";
import {
  executePortalCommercialOfferCommand,
  executeStaffCommercialOfferCommand,
} from "../agreements/commercial-service";
import type { CommercialOffer } from "../agreements/commercial-types";
import { consumeRequestRateLimit } from "../requests/rate-limit";

type Dependencies<Actor> = {
  enabled: boolean;
  origin: string;
  authorize: () => Promise<Actor | null>;
  createCorrelationId: () => string;
  execute: (
    actor: Actor,
    organisationId: string,
    input: unknown,
    correlationId: string,
  ) => Promise<CommercialOffer>;
  consumeRateLimit?: (
    actor: Actor,
    organisationId: string,
    correlationId: string,
  ) => Promise<boolean>;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};
export function createCommercialOfferRouteHandler<Actor>(
  deps: Dependencies<Actor>,
) {
  return async (
    request: Request,
    organisationId: string,
  ): Promise<Response> => {
    const correlationId = deps.createCorrelationId();
    const reply = (message: string, status: number) =>
      Response.json(
        { message },
        { status, headers: privateAuthHeaders(correlationId) },
      );
    if (!deps.enabled) return reply("Commercial offers are unavailable.", 404);
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return reply("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply("Send a JSON request.", 415);
    try {
      const actor = await deps.authorize();
      if (!actor) return reply("Sign in to continue.", 401);
      z.uuid().parse(organisationId);
      const input = await readJsonRequestBody(request, 64 * 1024);
      if (
        deps.consumeRateLimit &&
        !(await deps.consumeRateLimit(actor, organisationId, correlationId))
      )
        return reply("Too many requests. Wait a minute and try again.", 429);
      const offer = await deps.execute(
        actor,
        organisationId,
        input,
        correlationId,
      );
      return Response.json(
        { offer },
        { headers: privateAuthHeaders(correlationId) },
      );
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return reply("This offer is unavailable to your account.", 404);
      if (error instanceof AgreementConflict) return reply(error.message, 409);
      if (error instanceof z.ZodError)
        return reply("Check the commercial terms and try again.", 422);
      if (error instanceof PayloadTooLargeError)
        return reply("The request is too large.", 413);
      if (error instanceof SyntaxError) return reply("Send valid JSON.", 400);
      reportAuthError(deps, correlationId, error);
      return reply(
        "We could not confirm the result. Refresh before trying again.",
        503,
      );
    }
  };
}
export function commercialOfferRouteConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    enabled: signingEnabled(env),
    origin: resolvePortalOrigin(env),
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report: {
      correlationId: string;
      errorName: string;
    }) => console.error("Commercial offer request failed.", report),
  };
}
export function staffCommercialOfferRoute() {
  return createCommercialOfferRouteHandler({
    ...commercialOfferRouteConfiguration(),
    enabled: signingEnabled() && fssStudioEnabled(),
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) return null;
      try {
        return await requireFssAdmin(getPortalDb(), identity, randomUUID());
      } catch {
        return null;
      }
    },
    execute: (admin, organisationId, input, correlationId) =>
      executeStaffCommercialOfferCommand(
        getOperationsDb(),
        admin,
        organisationId,
        input,
        correlationId,
      ),
  });
}
export function portalCommercialOfferRoute() {
  return createCommercialOfferRouteHandler({
    ...commercialOfferRouteConfiguration(),
    authorize: getPortalIdentity,
    consumeRateLimit: (identity, organisationId, correlationId) =>
      consumeRequestRateLimit(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
      ),
    execute: (identity, organisationId, input, correlationId) =>
      executePortalCommercialOfferCommand(
        getPortalDb(),
        identity,
        organisationId,
        input,
        correlationId,
      ),
  });
}
