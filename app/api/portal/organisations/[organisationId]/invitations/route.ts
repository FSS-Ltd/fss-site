import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { resolvePortalOrigin, portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { createPortalInvitationMetadata } from "@/lib/operations/auth/clerk-invitation";
import { failOwnerInvitation, issueOwnerInvitation, ownerInvitationSchema } from "@/lib/operations/auth/owner-invitations";
import { createInvitationActivationUrl } from "@/lib/operations/auth/portal-url";
import { provisionPortalAccount, toPortalProvisioningErrorReport } from "@/lib/operations/auth/provision";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { operationsEnabled } from "@/lib/operations/db/client";
import { consumeRequestRateLimit } from "@/lib/operations/requests/rate-limit";
import { PayloadTooLargeError, readJsonRequestBody, requestHasRegisteredOrigin } from "@/lib/growth/http/founder-request";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }): Promise<Response> {
  const correlationId = randomUUID();
  const reply = (body: object, status: number) => Response.json(body, { status, headers: { "X-Correlation-Id": correlationId } });
  if (!operationsEnabled() || !portalAuthConfigured()) return reply({ message: "The portal is unavailable." }, 404);
  if (!requestHasRegisteredOrigin(request, new URL(resolveSiteUrl()).origin)) return reply({ message: "Request origin is not allowed." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({ message: "Send a JSON request." }, 415);
  try {
    const { organisationId } = await context.params;
    z.uuid().parse(organisationId);
    const identity = await getPortalIdentity();
    if (!identity) return reply({ message: "Sign in to continue." }, 401);
    const input = ownerInvitationSchema.parse(await readJsonRequestBody(request, 8 * 1024));
    const db = getPortalDb();
    if (!(await consumeRequestRateLimit(db, identity, organisationId, correlationId))) return reply({ message: "Too many invitations. Wait a minute and try again." }, 429);
    const invitationId = randomUUID();
    await issueOwnerInvitation(db, identity, organisationId, input, invitationId, correlationId);
    try {
      await provisionPortalAccount(input.email, createInvitationActivationUrl(resolvePortalOrigin(), input.name, input.email).href, createPortalInvitationMetadata({ invitationId, email: input.email }));
    } catch (error) {
      await failOwnerInvitation(db, identity, invitationId, correlationId);
      throw error;
    }
    return reply({ invitationId }, 201);
  } catch (error) {
    const status = error instanceof PayloadTooLargeError ? 413 : error instanceof z.ZodError ? 422 : 503;
    if (status === 503) console.error("Owner portal invitation failed.", { correlationId, error: toPortalProvisioningErrorReport(error) });
    return reply({ message: status === 422 ? "Check the invitation details and try again." : status === 413 ? "Invitation request is too large." : "The invitation could not be sent." }, status);
  }
}
