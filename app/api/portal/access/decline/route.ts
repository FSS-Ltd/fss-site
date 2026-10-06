import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { declinePortalInvitation } from "@/lib/operations/auth/decline-invitation";
import { privateAuthHeaders } from "@/lib/operations/auth/http";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { operationsEnabled } from "@/lib/operations/db/client";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  const reply = (body: object, status: number) =>
    Response.json(body, { status, headers: privateAuthHeaders(correlationId) });
  if (!operationsEnabled() || !portalAuthConfigured())
    return reply({ error: "Invitation decline is unavailable." }, 404);
  if (!requestHasRegisteredOrigin(request, new URL(resolveSiteUrl()).origin))
    return reply({ error: "The request origin is not allowed." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ error: "Send a JSON request." }, 415);
  try {
    const input = z
      .strictObject({ token: z.string() })
      .parse(await readJsonRequestBody(request, 1024));
    const declined = await declinePortalInvitation(
      getPortalDb(),
      input.token,
      correlationId,
    );
    return declined
      ? reply({ status: "declined" }, 200)
      : reply({ error: "This invitation can no longer be declined." }, 409);
  } catch (error) {
    if (error instanceof z.ZodError)
      return reply({ error: "Check the invitation and try again." }, 400);
    if (error instanceof PayloadTooLargeError)
      return reply({ error: "The request is too large." }, 413);
    if (error instanceof SyntaxError)
      return reply({ error: "Send valid JSON." }, 400);
    console.error("Portal invitation decline failed.", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return reply(
      { error: "The decline could not be confirmed. Try again." },
      503,
    );
  }
}
