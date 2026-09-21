import { randomUUID } from "node:crypto";
import {
  portalAuthConfigured,
  resolvePortalOrigin,
} from "@/lib/operations/auth/configuration";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { consumeRequestRateLimit } from "@/lib/operations/requests/rate-limit";
import { createPortalSupportRequest } from "@/lib/operations/support/client-support";
import { createPortalSupportRequestHandler } from "@/lib/operations/support/client-support-handler";

export async function POST(request: Request): Promise<Response> {
  let origin: string;
  try {
    origin = resolvePortalOrigin();
  } catch {
    return Response.json(
      { error: "The portal is unavailable." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return createPortalSupportRequestHandler({
    configured: portalAuthConfigured(),
    consumeRateLimit: (identity, organisationId, correlationId) =>
      consumeRequestRateLimit(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
      ),
    create: (identity, organisationId, correlationId, command) =>
      createPortalSupportRequest(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
        command,
      ),
    createCorrelationId: randomUUID,
    enabled: operationsEnabled(),
    getIdentity: getPortalIdentity,
    origin,
    reportUnexpectedError: (report) =>
      console.error("Portal support request failed.", report),
  })(request);
}
