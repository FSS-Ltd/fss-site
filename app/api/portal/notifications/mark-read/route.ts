import { randomUUID } from "node:crypto";
import {
  portalAuthConfigured,
  resolvePortalOrigin,
} from "@/lib/operations/auth/configuration";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { createNotificationReadHandler } from "@/lib/operations/workspaces/notification-read-handler";
import { markPortalNotificationsRead } from "@/lib/operations/workspaces/portal-repository";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let origin: string;
  try {
    origin = resolvePortalOrigin();
  } catch {
    return Response.json(
      { error: "Portal is unavailable." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return createNotificationReadHandler({
    authorize: getPortalIdentity,
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && portalAuthConfigured(),
    origin,
    reportUnexpectedError: (report) =>
      console.error("Portal notification update failed.", report),
    update: (identity, organisationId, correlationId, ids) =>
      markPortalNotificationsRead(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
        ids,
      ),
  })(request);
}
