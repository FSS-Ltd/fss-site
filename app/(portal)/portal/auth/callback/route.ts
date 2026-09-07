import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  PORTAL_INVITE_COOKIE,
  portalAuthConfigured,
  portalCookieOptions,
} from "@/lib/operations/auth/configuration";
import { createPortalCallbackHandler } from "@/lib/operations/auth/callback-handler";
import { claimPortalInvite } from "@/lib/operations/auth/invites";
import {
  createPortalServerClient,
  completePortalLogin,
} from "@/lib/operations/auth/server";
import { consumePortalAuthRateLimit } from "@/lib/operations/auth/rate-limit";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  const origin = new URL(resolveSiteUrl()).origin;
  return createPortalCallbackHandler({
    enabled: operationsEnabled(),
    configured: portalAuthConfigured(),
    origin,
    createCorrelationId: randomUUID,
    consumeRateLimit: consumePortalAuthRateLimit,
    completeLogin: async (code) =>
      completePortalLogin(await createPortalServerClient("write"), code),
    readPendingInvite: async () =>
      (await cookies()).get(PORTAL_INVITE_COOKIE)?.value ?? null,
    clearPendingInvite: async () => {
      (await cookies()).set(PORTAL_INVITE_COOKIE, "", {
        ...portalCookieOptions(origin),
        maxAge: 0,
      });
    },
    claimInvite: (identity, token, correlationId) =>
      claimPortalInvite(getPortalDb(), identity, token, correlationId),
    reportUnexpectedError: (report) =>
      console.error("Portal callback failed.", report),
  })(request);
}
