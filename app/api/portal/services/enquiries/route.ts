import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { privateAuthHeaders } from "@/lib/operations/auth/http";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { parseOfferEnquiry } from "@/lib/operations/offers/enquiries";
import { insertOfferEnquiry } from "@/lib/operations/offers/repository";
import { consumeRequestRateLimit } from "@/lib/operations/requests/rate-limit";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";

const bodySchema = z.strictObject({
  organisationId: z.uuid(),
  offerId: z.uuid(),
  idempotencyKey: z.uuid(),
  interest: z.string(),
  preferredStart: z.string().nullable().optional(),
  context: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  const reply = (body: object, status: number) =>
    Response.json(body, { status, headers: privateAuthHeaders(correlationId) });
  if (!operationsEnabled())
    return reply({ error: "The portal is unavailable." }, 404);
  if (!portalAuthConfigured())
    return reply({ error: "The portal is temporarily unavailable." }, 503);
  if (!requestHasRegisteredOrigin(request, new URL(resolveSiteUrl()).origin))
    return reply({ error: "The request origin is not allowed." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ error: "Send a JSON request." }, 415);
  try {
    const identity = await getPortalIdentity();
    if (!identity)
      return reply(
        { error: "Sign in to continue. Your message has been kept." },
        401,
      );
    const body = bodySchema.parse(
      await readJsonRequestBody(request, 24 * 1024),
    );
    if (
      !(await consumeRequestRateLimit(
        getPortalDb(),
        identity,
        body.organisationId,
        correlationId,
      ))
    )
      return reply(
        { error: "Too many requests. Wait a minute and try again." },
        429,
      );
    const enquiry = await insertOfferEnquiry(
      getPortalDb(),
      identity,
      body.organisationId,
      correlationId,
      parseOfferEnquiry(body),
    );
    return reply({ enquiry }, 200);
  } catch (error) {
    if (error instanceof PortalAccessDenied)
      return reply(
        { error: "This service is not available to your account." },
        404,
      );
    if (error instanceof z.ZodError)
      return reply({ error: "Check the enquiry details." }, 400);
    if (error instanceof PayloadTooLargeError)
      return reply({ error: "The enquiry is too large." }, 413);
    if (error instanceof SyntaxError)
      return reply({ error: "The request must contain valid JSON." }, 400);
    console.error("Portal service enquiry failed.", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return reply(
      { error: "We could not save your enquiry. Your message has been kept." },
      503,
    );
  }
}
