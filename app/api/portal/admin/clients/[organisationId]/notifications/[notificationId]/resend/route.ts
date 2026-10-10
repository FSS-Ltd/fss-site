import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";
import { privateAuthHeaders } from "@/lib/operations/auth/http";
import { fssStudioEnabled } from "@/lib/operations/auth/release-flags";
import { getOperationsDb } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  requestHasRegisteredOrigin,
  readJsonRequestBody,
} from "@/lib/growth/http/founder-request";
import { resendStaffAgreementNotification } from "@/lib/operations/agreements/agreement-notification-service";
import { AgreementConflict } from "@/lib/operations/agreements/types";

export const runtime = "nodejs";
const commandSchema = z.strictObject({
  offerId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  requestId: z.uuid(),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{ organisationId: string; notificationId: string }>;
  },
): Promise<Response> {
  const correlationId = randomUUID();
  const reply = (body: object, status: number) =>
    Response.json(body, {
      status,
      headers: privateAuthHeaders(correlationId),
    });
  if (!fssStudioEnabled())
    return reply({ error: "FSS Studio is unavailable." }, 404);
  if (!requestHasRegisteredOrigin(request, resolvePortalOrigin()))
    return reply({ error: "The request origin is not allowed." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ error: "Send a JSON request." }, 415);
  const identity = await getPortalIdentity();
  if (!identity) return reply({ error: "Sign in to continue." }, 401);
  try {
    const { organisationId, notificationId } = await context.params;
    z.uuid().parse(organisationId);
    z.uuid().parse(notificationId);
    const command = commandSchema.parse(
      await readJsonRequestBody(request, 1024),
    );
    const admin = await requireFssAdmin(getPortalDb(), identity, correlationId);
    await resendStaffAgreementNotification(
      getOperationsDb(),
      admin,
      organisationId,
      command.offerId,
      notificationId,
      command.expectedVersion,
      command.requestId,
      correlationId,
    );
    return reply({ ok: true }, 200);
  } catch (error) {
    if (error instanceof PortalAccessDenied)
      return reply({ error: "This offer is unavailable." }, 404);
    if (error instanceof AgreementConflict)
      return reply({ error: error.message }, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply({ error: "Check the delivery action." }, 400);
    console.error("Offer delivery resend failed.", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return reply(
      { error: "The offer email could not be resent. Try again." },
      503,
    );
  }
}
