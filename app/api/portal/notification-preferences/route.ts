import { randomUUID } from "node:crypto";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { operationsEnabled } from "@/lib/operations/db/client";
import { createNotificationPreferenceHandler } from "@/lib/operations/workspaces/notification-preference-handler";
import { updatePortalNotificationPreferences } from "@/lib/operations/workspaces/portal-repository";

export const runtime = "nodejs";

export async function PATCH(request: Request): Promise<Response> {
  let origin: string;
  try {
    origin = resolvePortalOrigin();
  } catch {
    return Response.json({ error: "Portal unavailable." }, { status: 404 });
  }
  return createNotificationPreferenceHandler({
    enabled: operationsEnabled(),
    origin,
    authorize: getPortalIdentity,
    update: (identity, organisationId, correlationId, command) =>
      updatePortalNotificationPreferences(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
        command,
      ),
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report) =>
      console.error("Portal notification preference update failed.", report),
  })(request);
}
