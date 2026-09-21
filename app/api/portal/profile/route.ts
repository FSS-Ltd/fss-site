import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import {
  portalAuthConfigured,
  resolvePortalOrigin,
} from "@/lib/operations/auth/configuration";
import { privateAuthHeaders } from "@/lib/operations/auth/http";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { savePortalProfile } from "@/lib/operations/auth/user-profile";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";

export async function PATCH(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  const reply = (body: object, status: number) =>
    Response.json(body, { status, headers: privateAuthHeaders(correlationId) });
  if (!operationsEnabled() || !portalAuthConfigured())
    return reply({ error: "The portal is unavailable." }, 404);
  if (!requestHasRegisteredOrigin(request, resolvePortalOrigin()))
    return reply({ error: "The request origin is not allowed." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ error: "Send a JSON request." }, 415);
  try {
    const identity = await getPortalIdentity();
    if (!identity) return reply({ error: "Sign in to continue." }, 401);
    const body = z
      .strictObject({ displayName: z.string(), organisationId: z.uuid() })
      .parse(await readJsonRequestBody(request, 1024));
    const profile = await savePortalProfile(
      getPortalDb(),
      identity,
      body.organisationId,
      body.displayName,
      correlationId,
    );
    return reply({ profile }, 200);
  } catch (error) {
    if (error instanceof PortalAccessDenied)
      return reply(
        { error: "This workspace is not available to your account." },
        404,
      );
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply({ error: "Check your profile name." }, 400);
    if (error instanceof PayloadTooLargeError)
      return reply({ error: "The profile update is too large." }, 413);
    return reply(
      { error: "We could not save your profile. Please try again." },
      503,
    );
  }
}
